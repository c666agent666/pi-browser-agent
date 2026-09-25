/**
 * Session store — persists sessionId → pi session file so a session
 * survives server restarts and subprocess death. Resuming works by
 * spawning a fresh `omp --mode rpc` and pointing it at the stored
 * session file via the `switch_session` RPC command.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface StoredSession {
	/** pi session file (JSONL) this id maps to. */
	sessionFile: string;
	updatedAt: number;
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
	map[sessionId] = { sessionFile, updatedAt: Date.now() };
	// Cap by recency only. Do NOT prune by fs.existsSync here: pi creates
	// the session file lazily (first persisted message), so a just-reported
	// path legitimately may not exist yet. Stale entries are handled at
	// resume time — switch_session fails gracefully and falls back to a
	// fresh conversation.
	const survivors = Object.entries(map)
		.sort((a, b) => b[1].updatedAt - a[1].updatedAt)
		.slice(0, 200);
	writeStore(Object.fromEntries(survivors));
}

export function removeSessionFile(sessionId: string): void {
	const map = readStore();
	delete map[sessionId];
	writeStore(map);
}