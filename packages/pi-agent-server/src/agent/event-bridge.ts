/**
 * Event bridge — maps pi `AgentEvent` frames (streamed verbatim by the
 * RPC subprocess) onto the extension-facing WS protocol.
 *
 * IMPORTANT: pi's streamed `message_update` events do not carry a stable
 * per-message id, so this bridge mints one per TURN (`turn_start` counts).
 * The client renders one assistant block per turn — streaming deltas
 * update that block in place instead of creating new lines.
 *
 * Source shapes (see pi packages/agent/src/types.ts AgentEvent):
 *   message_update: { message, assistantMessageEvent }
 *     assistantMessageEvent: { type: "text_delta", delta, partial }
 *                            | { type: "thinking_delta", delta, partial }
 *                            | { type: "toolcall_end", toolCall, partial }
 *   tool_execution_start: { toolCallId, toolName, args }
 *   tool_execution_end:   { toolCallId, toolName, result, isError }
 */

import type { ServerMessage } from "../types";

interface EventShape {
	type: string;
	[key: string]: unknown;
}

export type EventBridge = (rawEvent: unknown) => ServerMessage[];

/**
 * Create a per-session bridge. Each bridge keeps its own turn counter,
 * so message ids are stable within a session and unique across sessions.
 */
export function createEventBridge(): EventBridge {
	let turn = 0;

	return rawEvent => {
		const frames: ServerMessage[] = [];
		const event = rawEvent as EventShape;
		if (typeof event?.type !== "string") return frames;

		if (event.type === "turn_start") turn++;
		const messageId = `turn_${turn}`;

		switch (event.type) {
			case "message_update": {
				const message = event.message as { role?: string } | undefined;
				if (message?.role !== "assistant") break;

				const streamEvent = event.assistantMessageEvent as
					| { type?: string; delta?: string; partial?: unknown }
					| undefined;
				if (!streamEvent?.type) break;

				if (streamEvent.type === "text_delta" && typeof streamEvent.delta === "string") {
					frames.push({
						type: "assistant_token",
						payload: {
							messageId,
							delta: streamEvent.delta,
							text: messageText(streamEvent.partial),
						},
					});
				} else if (streamEvent.type === "thinking_delta" && typeof streamEvent.delta === "string") {
					frames.push({
						type: "thinking_token",
						payload: { messageId, delta: streamEvent.delta },
					});
				} else if (streamEvent.type === "toolcall_end") {
					const toolCall = (streamEvent as { toolCall?: { id?: string; name?: string; args?: unknown } })
						.toolCall;
					if (toolCall) {
						frames.push({
							type: "tool_call",
							payload: {
								id: String(toolCall.id ?? `tc_${turn}_${Date.now()}`),
								name: String(toolCall.name ?? "unknown"),
								args: (toolCall.args as Record<string, unknown>) ?? {},
								status: "running",
							},
						});
					}
				}
				break;
			}

			case "tool_execution_start": {
				frames.push({
					type: "tool_call",
					payload: {
						id: String(event.toolCallId ?? `tc_${turn}_${Date.now()}`),
						name: String(event.toolName ?? "unknown"),
						args: (event.args as Record<string, unknown>) ?? {},
						status: "running",
					},
				});
				break;
			}

			case "tool_execution_end": {
				const isError = Boolean(event.isError);
				const id = String(event.toolCallId ?? "");
				frames.push({
					type: "tool_call",
					payload: {
						id,
						name: String(event.toolName ?? "unknown"),
						args: {},
						status: isError ? "failed" : "completed",
					},
				});
				frames.push({
					type: "tool_result",
					payload: {
						id,
						name: String(event.toolName ?? "unknown"),
						result: event.result,
						isError,
					},
				});
				break;
			}

			case "turn_end": {
				frames.push({ type: "turn_end", payload: { messageId } });
				break;
			}
		}

		return frames;
	};
}

/** Extract plain text from an agent message (content may be a string or content blocks). */
export function messageText(partial: unknown): string {
	if (partial === null || partial === undefined) return "";
	if (typeof partial === "string") return partial;

	const message = partial as { content?: unknown };
	const content = message?.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map(block => {
				const b = block as { type?: string; text?: string };
				return b?.type === "text" && typeof b.text === "string" ? b.text : "";
			})
			.join("");
	}
	return "";
}