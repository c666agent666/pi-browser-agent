/**
 * Server configuration — resolved once from environment at startup.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ServerConfig {
	/** HTTP + WebSocket bind host. Local-only by default. */
	readonly host: string;
	/** HTTP + WebSocket port. */
	readonly port: number;
	/** pi CLI binary to spawn per session. */
	readonly ompBinary: string;
	/** Working directory for agent sessions. */
	readonly agentCwd: string;
	/** CDP endpoint for server-side screenshots (Aside/Chrome debug port). */
	readonly cdpUrl: string;
	/** Default Ollama Cloud vision model. */
	readonly visionModel: string;
	/** Idle subprocess shutdown (ms). */
	readonly idleTimeoutMs: number;
	/** Request timeout for pi RPC commands (ms). */
	readonly rpcTimeoutMs: number;
}

function intEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): ServerConfig {
	return {
		host: process.env.HOST ?? "127.0.0.1",
		port: intEnv("PORT", 3848),
		ompBinary: process.env.PI_BINARY ?? "omp",
		agentCwd: process.env.AGENT_CWD ?? process.cwd(),
		cdpUrl: process.env.CDP_URL ?? "http://127.0.0.1:9222",
		visionModel: process.env.VISION_MODEL ?? "gemma4:31b",
		idleTimeoutMs: intEnv("IDLE_TIMEOUT_MS", 30 * 60 * 1000),
		rpcTimeoutMs: intEnv("RPC_TIMEOUT_MS", 120_000),
	};
}

/** Resolve the Ollama Cloud API key: env var first, then ~/.ollama/auth.json. */
export function resolveOllamaApiKey(): string | null {
	if (process.env.OLLAMA_API_KEY) return process.env.OLLAMA_API_KEY;
	try {
		const authPath = path.join(os.homedir(), ".ollama", "auth.json");
		const auth = JSON.parse(fs.readFileSync(authPath, "utf-8")) as { key?: string };
		return auth.key ?? null;
	} catch {
		return null;
	}
}