export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  description?: string;
  status: "pending" | "approved" | "denied" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

export interface PageContext {
  url: string;
  title: string;
  selection: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  domSnapshot: string;
  meta: Record<string, string>;
}

export interface Screenshot {
  dataUrl: string;
  width: number;
  height: number;
  url: string;
  timestamp: number;
}

export interface PendingApproval {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ServerMessage {
  type: string;
  payload: unknown;
  requestId?: string;
}