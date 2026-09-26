/**
 * Session manager — one pi RPC subprocess per session, tracked by id,
 * with idle shutdown, respawn-on-reconnect, and cross-restart resume
 * via pi's `switch_session` command.
 */

import { PiRpcClient, type PiEvent } from "./pi-rpc-client";
import { getSessionFile, setSessionFile, listConversations, deleteConversation } from "./session-store";
import { createEventBridge, messageText } from "./event-bridge";
import { loadSettings } from "../settings";
import type { ServerConfig } from "../config";
import type { ServerMessage } from "../types";

export interface ManagedSession {
	sessionId: string;
	client: PiRpcClient;
	/** True when the panel reattached to a live or resumed subprocess. */
	resumed: boolean;
	attached: boolean;
	/** True once the auto-learn nudge has been sent for this session. */
	autolearnReminderSent: boolean;
}

export interface HistoryMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
}

export class SessionManager {
	#sessions = new Map<string, ManagedSession>();
	#idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
	#nextSession = 0;

	constructor(private readonly config: ServerConfig) {}

	get(sessionId: string): ManagedSession | undefined {
		return this.#sessions.get(sessionId);
	}

	list(): string[] {
		return [...this.#sessions.keys()];
	}

	/**
	 * Create a new session, or resume one:
	 *  - live subprocess → reattach
	 *  - dead subprocess with a stored pi session file → respawn and
	 *    `switch_session` into it (history preserved)
	 *  - dead subprocess, no file → fresh conversation
	 */
	async createOrResume(sessionId: string | undefined): Promise<ManagedSession> {
		if (sessionId) {
			const existing = this.#sessions.get(sessionId);
			if (existing && existing.client.alive) {
				existing.resumed = true;
				existing.attached = false;
				this.#clearIdle(sessionId);
				return existing;
			}
			if (existing) this.#destroy(sessionId);
		}

		const newId = sessionId ?? this.#mintId();
		const client = new PiRpcClient(this.config);
		await client.waitReady();

		const session: ManagedSession = { sessionId: newId, client, resumed: false, attached: false, autolearnReminderSent: false };
		this.#sessions.set(newId, session);

		// Try to resume from the stored pi session file.
		const storedFile = getSessionFile(newId);
		if (storedFile) {
			try {
				const response = await client.send("switch_session", { sessionPath: storedFile });
				if (response.success) {
					session.resumed = true;
					console.log(`[sessions] resumed ${newId} from ${storedFile}`);
				} else {
					console.warn(`[sessions] resume failed for ${newId}: ${response.error ?? "unknown"}`);
				}
			} catch (error) {
				console.warn(`[sessions] resume error for ${newId}:`, error);
			}
		}

		// Apply the persisted interaction model to fresh subprocesses so the
		// model choice survives restarts.
		const storedModel = loadSettings().interactionModel;
		if (storedModel) {
			try {
				const response = await client.send("set_model", {
					provider: storedModel.provider,
					modelId: storedModel.modelId,
				});
				if (!response.success) {
					console.warn(`[sessions] could not apply model ${storedModel.modelId}: ${response.error ?? "rejected"}`);
				}
			} catch (error) {
				console.warn(`[sessions] set_model failed:`, error);
			}
		}

		// Persist the session file so future restarts can resume this id.
		void this.#persistSessionFile(session);
		return session;
	}

	/** Ask pi for its session file and remember it. */
	async #persistSessionFile(session: ManagedSession): Promise<void> {
		try {
			const state = await session.client.send("get_state");
			const sessionFile = state.data?.sessionFile;
			if (typeof sessionFile === "string" && sessionFile.length > 0) {
				setSessionFile(session.sessionId, sessionFile);
			}
		} catch (error) {
			console.warn(`[sessions] get_state failed for ${session.sessionId}:`, error);
		}
	}

	/** Replayed conversation for a resumed session (user/assistant text only). */
	async history(sessionId: string): Promise<HistoryMessage[]> {
		const session = this.#sessions.get(sessionId);
		if (!session || !session.client.alive) return [];
		try {
			const response = await session.client.send("get_messages");
			const messages = (response.data?.messages ?? []) as Array<Record<string, unknown>>;
			const history: HistoryMessage[] = [];
			for (const message of messages) {
				const role = message.role;
				if (role !== "user" && role !== "assistant") continue;
				const text = messageText(message);
				if (!text.trim()) continue;
				history.push({ id: `hist_${history.length}`, role, text });
			}
			return history.slice(-100);
		} catch {
			return [];
		}
	}

	/** Wire event forwarding: every AgentEvent goes to the onFrame callback. */
	attach(sessionId: string, onFrame: (frame: ServerMessage) => void, onExit: () => void): void {
		const session = this.#sessions.get(sessionId);
		if (!session) return;
		session.attached = true;
		this.#clearIdle(sessionId);
		// One bridge per session — its turn counter mints stable message ids.
		const bridge = createEventBridge();
		session.client.onEvent = (event: PiEvent) => {
			for (const frame of bridge(event)) onFrame(frame);
			// Re-persist the session file after each completed turn: pi
			// creates the file lazily, so the path reported at spawn time
			// only exists on disk once the first message has been saved.
			if (event.type === "turn_end") void this.#persistSessionFile(session);
		};
		session.client.onExit = () => {
			onFrame({ type: "error", payload: { message: "pi agent process exited" } });
			this.#destroy(sessionId);
			onExit();
		};
	}

	/** Arm the idle shutdown for a session with no attached client. */
	scheduleIdleShutdown(sessionId: string): void {
		this.#clearIdle(sessionId);
		const timer = setTimeout(() => {
			const session = this.#sessions.get(sessionId);
			if (session && !session.attached) {
				console.log(`[sessions] idle timeout — stopping ${sessionId}`);
				this.#destroy(sessionId);
			}
		}, this.config.idleTimeoutMs);
		this.#idleTimers.set(sessionId, timer);
	}

	/** Destroy a session's subprocess immediately (used when its conversation is deleted). */
	destroySession(sessionId: string): void {
		this.#destroy(sessionId);
	}

	async closeAll(): Promise<void> {
		for (const id of [...this.#sessions.keys()]) this.#destroy(id);
	}

	#mintId(): string {
		return `sess_${Date.now().toString(36)}_${(this.#nextSession++).toString(36)}`;
	}

	#clearIdle(sessionId: string): void {
		const timer = this.#idleTimers.get(sessionId);
		if (timer) {
			clearTimeout(timer);
			this.#idleTimers.delete(sessionId);
		}
	}

	#destroy(sessionId: string): void {
		this.#clearIdle(sessionId);
		const session = this.#sessions.get(sessionId);
		if (!session) return;
		this.#sessions.delete(sessionId);
		void session.client.close();
		// The pi session file stays on disk — cross-restart resume depends
		// on it, and pi prunes old session files on its own schedule.
	}
}