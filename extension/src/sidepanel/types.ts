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
  | { type: "get_server_settings"; requestId: string }
  | { type: "get_models"; requestId: string }
  | { type: "set_interaction_model"; requestId: string; payload: { provider: string; modelId: string } }
  | { type: "set_vision_model"; requestId: string; payload: { model: string } }
  | { type: "test_model"; requestId: string; payload: { model: string } }
  | { type: "list_conversations"; requestId: string }
  | { type: "delete_conversation"; requestId: string; payload: { conversationId: string } }
  | { type: "ping" };

// ─── Server → Client ──────────────────────────────────────────────────────

export interface ModelRef {
  provider: string;
  modelId: string;
  name?: string;
}

export interface ServerSettingsState {
  visionModel: string;
  interactionModel?: ModelRef | null;
  activeModel?: ModelRef | null;
}

export interface ModelsListState {
  interaction: ModelRef[];
  vision: string[];
}

export interface TestModelResult {
  model: string;
  exists: boolean;
  capabilities: string[];
  liveTest: { ok: boolean; reply: string; latencyMs: number; error?: string };
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  lastActiveAt: number;
}

export type ServerMessage =
  | { type: "connected"; payload: { sessionId: string; resumed: boolean; model?: string } }
  | { type: "response"; requestId: string; payload: Record<string, unknown> }
  | { type: "error"; requestId?: string; payload: { message: string } }
  | { type: "assistant_token"; payload: { messageId: string; delta: string; text: string } }
  | { type: "thinking_token"; payload: { messageId: string; delta: string } }
  | { type: "tool_call"; payload: { id: string; name: string; args: Record<string, unknown>; status: "running" | "completed" | "failed" } }
  | { type: "tool_result"; payload: { id: string; name: string; result: unknown; isError: boolean } }
  | { type: "turn_end"; payload: { messageId: string } }
  | { type: "history"; payload: { messages: Array<{ id: string; role: "user" | "assistant"; text: string }> } }
  | { type: "server_settings"; requestId: string; payload: ServerSettingsState }
  | { type: "models"; requestId: string; payload: ModelsListState }
  | { type: "test_model_result"; requestId: string; payload: TestModelResult }
  | { type: "conversations"; requestId: string; payload: { conversations: ConversationMeta[] } }
  | { type: "screenshot_result"; requestId: string; payload: Screenshot }
  | { type: "vision_result"; requestId: string; payload: { analysis: string; model: string } }
  | { type: "pong" };