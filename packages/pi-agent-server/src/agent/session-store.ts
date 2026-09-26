/**
 * Session store — persists sessionId → pi session file so a session
 * survives server restarts and subprocess death. Resuming works by
 * spawning a fresh `omp --mode rpc` and pointing it at the stored
 * session file via the `switch_session` RPC command.
 *
 * v0.5: conversations registry — title (first user message), created/
 * updated timestamps, list + delete for the history panel.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface StoredSession {
	/** pi session file (JSONL) this id maps to. */
	sessionFile: string;
	/** Conversation title (first user message, truncated). */
	title?: string;
	/** When the conversation was first seen. */
	createdAt: number;
	updatedAt: number;
}

export interface ConversationSummary {
	id: string;
	title: string;
	createdAt: number;
	lastActiveAt: number;
}

const STORE_DIR = path.join(os.homedir(), ".pi-browser-agent");
const STORE_PATH = path.join(STORE_DIR, "sessions.json");

type StoreMap = Record<string, StoredSession>;

function readStore(): StoreMap {
	try {
		const raw = fs.readFileSync(STORE_PATH, "utf-8");
		const parsed = JSON.parse(raw) as StoreMap;
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

function writeStore(map: StoreMap): void {
	try {
		fs.mkdirSync(STORE_DIR, { recursive: true });
		fs.writeFileSync(STORE_PATH, JSON.stringify(map, null, "\t"));
	} catch (error) {
		console.error("[session-store] failed to persist:", error);
	}
}

export function getSessionFile(sessionId: string): string | undefined {
	return readStore()[sessionId]?.sessionFile;
}

export function setSessionFile(sessionId: string, sessionFile: string): void {
	const map = readStore();
	const existing = map[sessionId];
	map[sessionId] = {
		sessionFile,
		title: existing?.title,
		createdAt: existing?.createdAt ?? Date.now(),
		updatedAt: Date.now(),
	};
	writeStore(capStore(map));
}

/** Set/update a conversation title (used for the first user message). */
export function setConversationTitle(sessionId: string, title: string): void {
	const map = readStore();
	const existing = map[sessionId];
	if (!existing || existing.title) return; // only set once, on first message
	existing.title = title.slice(0, 80);
	writeStore(map);
}

/** All conversations, newest activity first. */
export function listConversations(): ConversationSummary[] {
	const map = readStore();
	return Object.entries(map)
		.map(([id, entry]) => ({
			id,
			title: entry.title ?? "untitled conversation",
			createdAt: entry.createdAt ?? entry.updatedAt ?? 0,
			lastActiveAt: entry.updatedAt ?? entry.createdAt ?? 0,
		}))
		.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

/**
 * Delete a conversation: removes the registry entry and deletes the pi
 * session file from disk (best-effort). Returns whether anything was
 * removed.
 */
export function deleteConversation(sessionId: string): boolean {
	const map = readStore();
	const entry = map[sessionId];
	if (!entry) return false;
	delete map[sessionId];
	writeStore(map);
	try {
		fs.rmSync(entry.sessionFile, { force: true });
	} catch {
		// registry entry is already gone — an undeletable file is not fatal
	}
	return true;
}

/** Keep the store bounded: newest 200 by updatedAt. */
function capStore(map: StoreMap): StoreMap {
	const survivors = Object.entries(map)
		.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
		.slice(0, 200);
	return Object.fromEntries(survivors);
}