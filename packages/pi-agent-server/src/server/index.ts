#!/usr/bin/env bun
/**
 * Pi Browser Agent Server
 *
 * HTTP + WebSocket server that runs pi agent sessions and exposes them
 * to a browser extension side panel via WebSocket.
 *
 * Architecture:
 * - Bun.serve() with WebSocket upgrade
 * - Each WS connection = one agent session (or resumes existing)
 * - Tool calls stream over WS; approval requests pause agent until user responds
 * - Browser tool (CDP) for screenshots/vision analysis
 */

import { createAgentSession, type AgentSession } from "@oh-my-pi/pi-coding-agent/sdk";
import { logger } from "@oh-my-pi/pi-utils";
import { WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Types ────────────────────────────────────────────────────────────────

interface WSMessage {
  type: string;
  payload: unknown;
  requestId?: string;
}

interface AgentSessionState {
  session: AgentSession;
  ws: WebSocket;
  pendingApprovals: Map<string, { resolve: (approved: boolean) => void; toolCall: ToolCallInfo }>;
  messageId: number;
}

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

interface BrowserScreenshotResult {
  dataUrl: string; // base64 PNG
  width: number;
  height: number;
  url: string;
  timestamp: number;
}

// ─── Config ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3848", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const EXTENSION_DIST = resolve(__dirname, "../../extension/dist");
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle timeout

// ─── Session Registry ─────────────────────────────────────────────────────

const sessions = new Map<string, AgentSessionState>();

function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── WebSocket Helpers ────────────────────────────────────────────────────

function send(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToSession(sessionId: string, msg: WSMessage): void {
  const state = sessions.get(sessionId);
  if (state) send(state.ws, msg);
}

// ─── Agent Session Management ─────────────────────────────────────────────

async function createOrResumeSession(sessionId?: string): Promise<AgentSessionState> {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const id = sessionId ?? generateSessionId();

  // Create headless agent session via SDK
  const result = await createAgentSession({
    mode: "headless",
    cwd: process.cwd(),
    // Resume from session file if exists
    resumeSession: sessionId ? id : undefined,
  });

  const state: AgentSessionState = {
    session: result.session,
    ws: null as any, // set after WS upgrade
    pendingApprovals: new Map(),
    messageId: 0,
  };

  sessions.set(id, state);

  // Wire up tool call interception for approval flow
  result.session.on("tool_call", async (call) => {
    await handleToolCall(id, call);
  });

  result.session.on("tool_result", (result) => {
    broadcastToSession(id, {
      type: "tool_result",
      payload: { callId: result.callId, result: result.result, error: result.error },
    });
  });

  result.session.on("assistant_message", (msg) => {
    broadcastToSession(id, {
      type: "assistant_token",
      payload: { text: msg.content, messageId: state.messageId++ },
    });
  });

  result.session.on("close", () => {
    sessions.delete(id);
  });

  // Idle timeout
  setTimeout(() => {
    const s = sessions.get(id);
    if (s && s.ws.readyState !== WebSocket.OPEN) {
      s.session.close();
      sessions.delete(id);
    }
  }, SESSION_TIMEOUT_MS);

  return state;
}

async function handleToolCall(sessionId: string, call: any): Promise<void> {
  const state = sessions.get(sessionId);
  if (!state) return;

  const toolInfo: ToolCallInfo = {
    id: call.id,
    name: call.tool,
    args: call.args,
    description: call.description,
  };

  // Check if tool requires approval (bash, edit, write, etc.)
  const requiresApproval = ["bash", "edit", "write", "apply_patch", "task"].includes(call.tool);

  if (requiresApproval && state.ws.readyState === WebSocket.OPEN) {
    // Pause agent, request approval
    const approved = await new Promise<boolean>((resolve) => {
      state.pendingApprovals.set(call.id, { resolve, toolCall: toolInfo });
      send(state.ws, {
        type: "approval_request",
        payload: { callId: call.id, tool: call.tool, args: call.args, description: call.description },
      });
    });

    if (!approved) {
      state.session.rejectToolCall(call.id, "User denied approval");
      return;
    }
  }

  // Tool approved (or doesn't require approval) — continue execution
  // The SDK handles actual execution; we just signal approval
  state.session.approveToolCall(call.id);
}

// ─── Browser / Vision Integration ─────────────────────────────────────────

async function captureScreenshot(url: string): Promise<BrowserScreenshotResult> {
  // Use pi's browser tool via CDP
  // This would connect to the running Aside/Chrome instance on port 9222
  const cdpUrl = process.env.CDP_URL ?? "http://127.0.0.1:9222";

  try {
    const response = await fetch(`${cdpUrl}/json/list`);
    const targets = await response.json();
    const page = targets.find((t: any) => t.type === "page" && t.url.includes(url));
    if (!page) throw new Error("No matching page found");

    const wsUrl = page.webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "png" } }));
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 1 && msg.result?.data) {
          resolve({
            dataUrl: `data:image/png;base64,${msg.result.data}`,
            width: 0,
            height: 0,
            url,
            timestamp: Date.now(),
          });
          ws.close();
        }
      };
      ws.onerror = reject;
      setTimeout(() => reject(new Error("Screenshot timeout")), 10000);
    });
  } catch (error) {
    logger.error("Screenshot failed", { url, error: String(error) });
    throw error;
  }
}

async function analyzeScreenshotWithVision(dataUrl: string, prompt: string): Promise<string> {
  // Use the agent's configured vision model via a direct LLM call
  // This would use the same model registry as the agent
  const { createModelClient } = await import("@oh-my-pi/pi-ai");
  const { getModel } = await import("@oh-my-pi/pi-catalog");

  const model = getModel("qwen2.5-vl-72b"); // or configured vision model
  if (!model) throw new Error("No vision model configured");

  const client = createModelClient(model);
  const response = await client.generate({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: dataUrl },
        ],
      },
    ],
  });

  return response.text;
}

// ─── HTTP Request Handler ─────────────────────────────────────────────────

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS for extension
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // API endpoints
  if (path === "/api/session" && req.method === "POST") {
    const { sessionId } = await req.json();
    const state = await createOrResumeSession(sessionId);
    return Response.json(
      { sessionId: state.session.id, cwd: process.cwd() },
      { headers: corsHeaders }
    );
  }

  if (path === "/api/session" && req.method === "GET") {
    const sessionId = url.searchParams.get("sessionId");
    const state = sessions.get(sessionId ?? "");
    return Response.json(
      { exists: !!state, sessionId: state?.session.id },
      { headers: corsHeaders }
    );
  }

  if (path === "/api/screenshot" && req.method === "POST") {
    const { url: targetUrl } = await req.json();
    const screenshot = await captureScreenshot(targetUrl);
    return Response.json(screenshot, { headers: corsHeaders });
  }

  if (path === "/api/vision" && req.method === "POST") {
    const { dataUrl, prompt } = await req.json();
    const analysis = await analyzeScreenshotWithVision(dataUrl, prompt);
    return Response.json({ analysis }, { headers: corsHeaders });
  }

  // Static files (extension UI)
  if (path === "/" || path.startsWith("/assets/") || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")) {
    const filePath = path === "/" ? "/index.html" : path;
    const fullPath = join(EXTENSION_DIST, filePath);

    if (existsSync(fullPath)) {
      const file = Bun.file(fullPath);
      const headers = new Headers({ ...corsHeaders });
      headers.set("Content-Type", getContentType(fullPath));
      return new Response(file, { headers });
    }
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

// ─── WebSocket Upgrade Handler ────────────────────────────────────────────

function handleWebSocketUpgrade(req: Request, server: any): Response | void {
  const url = new URL(req.url);
  if (url.pathname !== "/ws") return;

  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("sessionId required", { status: 400 });
  }

  return server.upgrade(req, {
    data: { sessionId },
    headers: {
      "Sec-WebSocket-Protocol": "pi-agent-v1",
    },
  });
}

// ─── WebSocket Message Handler ────────────────────────────────────────────

async function handleWSMessage(ws: WebSocket, data: string, sessionId: string): Promise<void> {
  const state = sessions.get(sessionId);
  if (!state) {
    send(ws, { type: "error", payload: { message: "Session not found" } });
    return;
  }

  state.ws = ws; // Update WS reference (handles reconnection)

  let msg: WSMessage;
  try {
    msg = JSON.parse(data);
  } catch {
    send(ws, { type: "error", payload: { message: "Invalid JSON" } });
    return;
  }

  switch (msg.type) {
    case "chat": {
      const { message, context } = msg.payload as { message: string; context?: any };
      state.messageId++;
      send(ws, { type: "user_message", payload: { messageId: state.messageId, text: message } });

      // Send to agent
      try {
        await state.session.sendMessage(message, {
          context: context ? JSON.stringify(context) : undefined,
        });
      } catch (error) {
        send(ws, { type: "error", payload: { message: String(error) } });
      }
      break;
    }

    case "approval_response": {
      const { callId, approved } = msg.payload as { callId: string; approved: boolean };
      const pending = state.pendingApprovals.get(callId);
      if (pending) {
        pending.resolve(approved);
        state.pendingApprovals.delete(callId);
      }
      break;
    }

    case "get_history": {
      // Return session history
      const history = state.session.getHistory?.() ?? [];
      send(ws, { type: "history", payload: { messages: history } });
      break;
    }

    case "screenshot": {
      const { url } = msg.payload as { url: string };
      try {
        const screenshot = await captureScreenshot(url);
        send(ws, { type: "screenshot_result", payload: screenshot });
      } catch (error) {
        send(ws, { type: "error", payload: { message: String(error) } });
      }
      break;
    }

    case "vision": {
      const { dataUrl, prompt } = msg.payload as { dataUrl: string; prompt: string };
      try {
        const analysis = await analyzeScreenshotWithVision(dataUrl, prompt);
        send(ws, { type: "vision_result", payload: { analysis } });
      } catch (error) {
        send(ws, { type: "error", payload: { message: String(error) } });
      }
      break;
    }

    case "ping": {
      send(ws, { type: "pong", payload: {} });
      break;
    }

    default:
      send(ws, { type: "error", payload: { message: `Unknown message type: ${msg.type}` } });
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req, server) {
    // Try WebSocket upgrade first
    const wsResponse = handleWebSocketUpgrade(req, server);
    if (wsResponse) return wsResponse;

    // Regular HTTP
    return handleRequest(req);
  },
  websocket: {
    open(ws) {
      const sessionId = ws.data.sessionId;
      logger.info("WS connected", { sessionId });
      createOrResumeSession(sessionId).then((state) => {
        state.ws = ws;
        send(ws, { type: "connected", payload: { sessionId: state.session.id } });
      }).catch((err) => {
        send(ws, { type: "error", payload: { message: String(err) } });
        ws.close();
      });
    },
    message(ws, data) {
      handleWSMessage(ws, data.toString(), ws.data.sessionId);
    },
    close(ws) {
      logger.info("WS disconnected", { sessionId: ws.data.sessionId });
    },
  },
});

console.log(`🚀 Pi Agent Server running at http://${HOST}:${PORT}`);
console.log(`   WebSocket: ws://${HOST}:${PORT}/ws?sessionId=<id>`);
console.log(`   Extension UI: http://${HOST}:${PORT}/`);
console.log(`   CDP target: ${process.env.CDP_URL ?? "http://127.0.0.1:9222"}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  for (const [, state] of sessions) {
    state.session.close();
  }
  server.stop();
  process.exit(0);
});