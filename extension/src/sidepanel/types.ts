/**
 * Mirror of the server wire protocol (PROTOCOL.md).
 * Keep in sync with packages/pi-agent-server/src/types.ts.
 */

export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinking?: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

export interface PageContextSummary {
  url: string;
  title: string;
  selection?: string;
  domSnapshot?: string;
  viewport?: { width: number; height: number; scrollX: number; scrollY: number };
  meta?: Record<string, string>;
}

export interface Screenshot {
  dataUrl: string;
  width: number;
  height: number;
  url: string;
  timestamp: number;
}

// ─── Client → Server ───────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "chat"; requestId: string; payload: { message: string; context?: PageContextSummary; images?: string[] } }
  | { type: "abort"; requestId: string }
  | { type: "new_session"; requestId: string }
  | { type: "get_state"; requestId: string }
  | { type: "screenshot"; requestId: string; payload: { url?: string } }
  | { type: "vision"; requestId: string; payload: { image: string; prompt: string; model?: string } }
  | { type: "ping" };

// ─── Server → Client ──────────────────────────────────────────────────────

export type ServerMessage =
  | { type: "connected"; payload: { sessionId: string; resumed: boolean; model?: string } }
  | { type: "response"; requestId: string; payload: Record<string, unknown> }
  | { type: "error"; requestId?: string; payload: { message: string } }
  | { type: "assistant_token"; payload: { messageId: string; delta: string; text: string } }
  | { type: "thinking_token"; payload: { messageId: string; delta: string } }
  | { type: "tool_call"; payload: { id: string; name: string; args: Record<string, unknown>; status: "running" | "completed" | "failed" } }
  | { type: "tool_result"; payload: { id: string; name: string; result: unknown; isError: boolean } }
  | { type: "turn_end"; payload: { messageId: string } }
  | { type: "screenshot_result"; requestId: string; payload: Screenshot }
  | { type: "vision_result"; requestId: string; payload: { analysis: string; model: string } }
  | { type: "pong" };