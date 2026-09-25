/**
 * Session manager — one pi RPC subprocess per session, tracked by id,
 * with idle shutdown and reconnect/respawn semantics.
 */

import { PiRpcClient, type PiEvent } from "./pi-rpc-client";
import { bridgeEvents } from "./event-bridge";
import type { ServerConfig } from "../config";
import type { ServerMessage } from "../types";

export interface ManagedSession {
	sessionId: string;
	client: PiRpcClient;
	resumed: boolean;
	/** True once a WebSocket client has been attached since the last spawn. */
	attached: boolean;
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
	 * Create a new session or reattach to a live one. If the requested
	 * session died while the panel was closed, a fresh subprocess is
	 * spawned and `resumed: false` is reported.
	 */
	async createOrResume(sessionId: string | undefined): Promise<ManagedSession> {
		if (sessionId) {
			const existing = this.#sessions.get(sessionId);
			if (existing && existing.client.alive) {
				existing.resumed = true;
				this.#clearIdle(sessionId);
				return existing;
			}
			if (existing) this.#destroy(sessionId);
		}

		const newId = sessionId ?? this.#mintId();
		const client = new PiRpcClient(this.config);
		await client.waitReady();

		const session: ManagedSession = { sessionId: newId, client, resumed: false, attached: false };
		this.#sessions.set(newId, session);
		return session;
	}

	/** Wire event forwarding: every AgentEvent goes to the onFrame callback. */
	attach(sessionId: string, onFrame: (frame: ServerMessage) => void, onExit: () => void): void {
		const session = this.#sessions.get(sessionId);
		if (!session) return;
		session.attached = true;
		this.#clearIdle(sessionId);
		session.client.onEvent = (event: PiEvent) => {
			for (const frame of bridgeEvents(event)) onFrame(frame);
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
	}
}