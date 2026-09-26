/**
 * Wire protocol between the extension side panel and the server.
 * Mirrored in extension/src/sidepanel/types.ts — keep in sync.
 * Full contract: PROTOCOL.md.
 */

// ─── Client → Server ───────────────────────────────────────────────────────

export interface ChatRequest {
	type: "chat";
	requestId: string;
	payload: {
		message: string;
		/** Optional page context (DOM snapshot, selection, URL) prepended to the prompt. */
		context?: PageContextSummary;
		/** Optional base64 images (data URLs) sent with the message. */
		images?: string[];
	};
}

export interface AbortRequest {
	type: "abort";
	requestId: string;
}

export interface NewSessionRequest {
	type: "new_session";
	requestId: string;
}

export interface GetStateRequest {
	type: "get_state";
	requestId: string;
}

export interface ServerScreenshotRequest {
	type: "screenshot";
	requestId: string;
	payload: { url?: string };
}

export interface VisionRequest {
	type: "vision";
	requestId: string;
	payload: { image: string; prompt: string; model?: string };
}

export interface PingRequest {
	type: "ping";
}

/** Ask the server for its model configuration + what's available. */
export interface GetSettingsRequest {
	type: "get_server_settings";
	requestId: string;
}

/** List pi's available interaction models + Ollama vision-capable models. */
export interface GetModelsRequest {
	type: "get_models";
	requestId: string;
}

/** Change the agent's interaction model (pi set_model), persisted. */
export interface SetInteractionModelRequest {
	type: "set_interaction_model";
	requestId: string;
	payload: { provider: string; modelId: string };
}

/** Change the vision model used for screenshot analysis, persisted. */
export interface SetVisionModelRequest {
	type: "set_vision_model";
	requestId: string;
	payload: { model: string };
}

/** Test a model against the real Ollama Cloud account: existence, capabilities, and a live chat probe. */
export interface TestModelRequest {
	type: "test_model";
	requestId: string;
	payload: { model: string };
}

export interface TestModelResult {
	model: string;
	exists: boolean;
	capabilities: string[];
	/** Live one-shot chat probe: did an actual request succeed? */
	liveTest: {
		ok: boolean;
		reply: string;
		latencyMs: number;
		error?: string;
	};
}

export type ClientMessage =
	| ChatRequest
	| AbortRequest
	| NewSessionRequest
	| GetStateRequest
	| ServerScreenshotRequest
	| VisionRequest
	| GetSettingsRequest
	| GetModelsRequest
	| SetInteractionModelRequest
	| SetVisionModelRequest
	| TestModelRequest
	| PingRequest;

// ─── Server → Client ──────────────────────────────────────────────────────

export interface ConnectedFrame {
	type: "connected";
	payload: { sessionId: string; resumed: boolean; model?: string };
}

export interface ResponseFrame {
	type: "response";
	requestId: string;
	payload: Record<string, unknown>;
}

export interface ErrorFrame {
	type: "error";
	requestId?: string;
	payload: { message: string };
}

/** Streaming assistant text. `text` is cumulative; `delta` is the increment. */
export interface AssistantTokenFrame {
	type: "assistant_token";
	payload: { messageId: string; delta: string; text: string };
}

/** Streaming reasoning/thinking text. */
export interface ThinkingTokenFrame {
	type: "thinking_token";
	payload: { messageId: string; delta: string };
}

export interface ToolCallFrame {
	type: "tool_call";
	payload: {
		id: string;
		name: string;
		args: Record<string, unknown>;
		status: "running" | "completed" | "failed";
		description?: string;
	};
}

export interface ToolResultFrame {
	type: "tool_result";
	payload: { id: string; name: string; result: unknown; isError: boolean };
}

export interface TurnEndFrame {
	type: "turn_end";
	payload: { messageId: string };
}

export interface ScreenshotResultFrame {
	type: "screenshot_result";
	requestId: string;
	payload: { dataUrl: string; url: string; width: number; height: number; timestamp: number };
}

export interface VisionResultFrame {
	type: "vision_result";
	requestId: string;
	payload: { analysis: string; model: string };
}

export interface PongFrame {
	type: "pong";
}

/** Reserved for forward compatibility (pi RPC mode has no approval flow yet). */
export interface ApprovalRequestFrame {
	type: "approval_request";
	payload: { callId: string; tool: string; args: Record<string, unknown> };
}

/** Server settings + live model state (answer to get_server_settings). */
export interface ServerSettingsFrame {
	type: "server_settings";
	requestId: string;
	payload: {
		visionModel: string;
		interactionModel?: { provider: string; modelId: string } | null;
		/** Model pi is actually running right now (from get_state). */
		activeModel?: { provider: string; modelId: string } | null;
	};
}

/** Available models (answer to get_models). */
export interface ModelsFrame {
	type: "models";
	requestId: string;
	payload: {
		interaction: Array<{ provider: string; modelId: string; name?: string }>;
		vision: string[];
	};
}

/** Result of a model test (answer to test_model). */
export interface TestModelResultFrame {
	type: "test_model_result";
	requestId: string;
	payload: TestModelResult;
}

export interface HistoryFrame {
	type: "history";
	payload: { messages: Array<{ id: string; role: "user" | "assistant"; text: string }> };
}

export type ServerMessage =
	| ConnectedFrame
	| ResponseFrame
	| ErrorFrame
	| AssistantTokenFrame
	| ThinkingTokenFrame
	| ToolCallFrame
	| ToolResultFrame
	| TurnEndFrame
	| ScreenshotResultFrame
	| VisionResultFrame
	| PongFrame
	| ApprovalRequestFrame
	| HistoryFrame
	| ServerSettingsFrame
	| ModelsFrame
	| TestModelResultFrame;

// ─── Shared payloads ───────────────────────────────────────────────────────

export interface PageContextSummary {
	url: string;
	title: string;
	selection?: string;
	domSnapshot?: string;
	viewport?: { width: number; height: number; scrollX: number; scrollY: number };
}