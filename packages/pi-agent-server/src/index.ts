#!/usr/bin/env bun
/**
 * pi-browser-agent server — entry point.
 *
 * Bun.serve with WebSocket upgrade. One WS connection maps to one pi
 * agent session (an `omp --mode rpc` subprocess). See PROTOCOL.md.
 */

import { loadConfig } from "./config";
import { SessionManager } from "./agent/session-manager";
import { corsPreflight, handleApi } from "./http/api";
import { handleClientMessage } from "./ws/handlers";
import type { ClientMessage, ServerMessage } from "./types";

const config = loadConfig();
const manager = new SessionManager(config);

interface WsData {
	sessionId: string;
}

const server = Bun.serve<WsData>({
	port: config.port,
	hostname: config.host,
	idleTimeout: 0, // rely on our own ping/pong + idle shutdown

	async fetch(request, server) {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") return corsPreflight();

		if (url.pathname.startsWith("/api/")) {
			return handleApi(request, url.pathname, config, () => manager.list());
		}

		if (url.pathname === "/ws") {
			const requestedSession = url.searchParams.get("sessionId") ?? undefined;
			if (server.upgrade(request, { data: { sessionId: requestedSession ?? "" } })) return;
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		return new Response("Not found", { status: 404 });
	},

	websocket: {
		async open(ws) {
			const requested = (ws.data as WsData).sessionId || undefined;
			try {
				const session = await manager.createOrResume(requested);
				(ws.data as WsData).sessionId = session.sessionId;

				manager.attach(
					session.sessionId,
					frame => sendSafe(ws, frame),
					() => {
						// pi subprocess died; panel should offer a reconnect.
						sendSafe(ws, { type: "error", payload: { message: "agent process exited" } } satisfies ServerMessage);
					},
				);

				sendSafe(ws, {
					type: "connected",
					payload: { sessionId: session.sessionId, resumed: session.resumed },
				});

				// On resume, replay the conversation so the panel can render it.
				if (session.resumed) {
					const history = await manager.history(session.sessionId);
					sendSafe(ws, { type: "history", payload: { messages: history } });
				}
			} catch (error) {
				console.error("[ws] session setup failed:", error);
				sendSafe(ws, {
					type: "error",
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
				ws.close();
			}
		},

		async message(ws, data) {
			let frame: ClientMessage;
			try {
				frame = JSON.parse(String(data)) as ClientMessage;
			} catch {
				sendSafe(ws, { type: "error", payload: { message: "Invalid JSON frame" } });
				return;
			}

			try {
				await handleClientMessage(
					frame,
					{
						sessionId: (ws.data as WsData).sessionId,
						send: message => sendSafe(ws, message),
					},
					manager,
					config,
				);
			} catch (error) {
				sendSafe(ws, {
					type: "error",
					requestId: "requestId" in frame ? frame.requestId : undefined,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
		},

		close(ws) {
			const sessionId = (ws.data as WsData).sessionId;
			if (sessionId) manager.scheduleIdleShutdown(sessionId);
		},
	},
});

function sendSafe(ws: { send: (data: string) => void }, frame: ServerMessage): void {
	try {
		ws.send(JSON.stringify(frame));
	} catch {
		// socket closed mid-send — close handler schedules idle shutdown
	}
}

console.log(`pi-browser-agent server`);
console.log(`  ws://    ${config.host}:${server.port}/ws?sessionId=<id>`);
console.log(`  health:  http://${config.host}:${server.port}/api/health`);
console.log(`  agent:   ${config.ompBinary} --mode rpc (cwd ${config.agentCwd})`);
console.log(`  vision:  ${config.visionModel} via Ollama Cloud`);
console.log(`  cdp:     ${config.cdpUrl}`);

process.on("SIGINT", async () => {
	console.log("\nShutting down…");
	await manager.closeAll();
	server.stop();
	process.exit(0);
});
process.on("SIGTERM", async () => {
	await manager.closeAll();
	server.stop();
	process.exit(0);
});