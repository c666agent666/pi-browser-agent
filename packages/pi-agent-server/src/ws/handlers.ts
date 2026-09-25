/**
 * WebSocket handlers — dispatches ClientMessage frames from the side panel.
 * One WS connection maps to one agent session (minted on upgrade).
 */

import type { ServerConfig } from "../config";
import type { SessionManager } from "../agent/session-manager";
import { captureScreenshot } from "../browser/cdp";
import { analyzeScreenshot } from "../vision/ollama-vision";
import type { ClientMessage, ServerMessage } from "../types";

export interface WsSessionContext {
	sessionId: string;
	send: (frame: ServerMessage) => void;
}

/** Format page context into a prompt preamble for pi. */
function formatContextPrompt(context: {
	url: string;
	title?: string;
	selection?: string;
	domSnapshot?: string;
	viewport?: { width: number; height: number; scrollX: number; scrollY: number };
}): string {
	const parts = [`Current page: ${context.url}`];
	if (context.title) parts.push(`Title: ${context.title}`);
	if (context.viewport) {
		parts.push(
			`Viewport: ${context.viewport.width}x${context.viewport.height} @ scroll(${context.viewport.scrollX}, ${context.viewport.scrollY})`,
		);
	}
	if (context.selection?.trim()) parts.push(`User selection:\n${context.selection.trim()}`);
	if (context.domSnapshot?.trim()) parts.push(`DOM snapshot (truncated):\n${context.domSnapshot.trim()}`);
	return parts.join("\n");
}

export async function handleClientMessage(
	message: ClientMessage,
	ctx: WsSessionContext,
	manager: SessionManager,
	config: ServerConfig,
): Promise<void> {
	const session = manager.get(ctx.sessionId);
	if (!session) {
		ctx.send({ type: "error", payload: { message: "Session is gone — reconnect" } });
		return;
	}

	switch (message.type) {
		case "ping": {
			ctx.send({ type: "pong" });
			return;
		}

		case "chat": {
			const { message: text, context, images } = message.payload;
			if (!text.trim()) {
				ctx.send({ type: "error", requestId: message.requestId, payload: { message: "Empty message" } });
				return;
			}

			// Prepend page context (if provided) to the user prompt.
			const prompt = context ? `<page-context>\n${formatContextPrompt(context)}\n</page-context>\n\n${text}` : text;

			try {
				const response = await session.client.send("prompt", {
					message: prompt,
					images: images?.length ? images.map(stripDataUrl) : undefined,
				});
				if (!response.success) {
					ctx.send({
						type: "error",
						requestId: message.requestId,
						payload: { message: response.error ?? "prompt rejected" },
					});
					return;
				}
				ctx.send({
					type: "response",
					requestId: message.requestId,
					payload: { accepted: true },
				});
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}

		case "abort": {
			try {
				await session.client.notify("abort");
				ctx.send({ type: "response", requestId: message.requestId, payload: { aborted: true } });
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}

		case "new_session": {
			try {
				const response = await session.client.send("new_session");
				ctx.send({
					type: "response",
					requestId: message.requestId,
					payload: { success: response.success, ...(response.data ?? {}) },
				});
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}

		case "get_state": {
			try {
				const response = await session.client.send("get_state");
				if (response.success) {
					ctx.send({
						type: "response",
						requestId: message.requestId,
						payload: response.data ?? {},
					});
				} else {
					ctx.send({
						type: "error",
						requestId: message.requestId,
						payload: { message: response.error ?? "get_state failed" },
					});
				}
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}

		case "screenshot": {
			try {
				const shot = await captureScreenshot(config, message.payload.url);
				ctx.send({ type: "screenshot_result", requestId: message.requestId, payload: shot });
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}

		case "vision": {
			try {
				const { image, prompt, model } = message.payload;
				const result = await analyzeScreenshot(config, image, prompt, model);
				ctx.send({
					type: "vision_result",
					requestId: message.requestId,
					payload: { analysis: result.analysis, model: result.model },
				});
			} catch (error) {
				ctx.send({
					type: "error",
					requestId: message.requestId,
					payload: { message: error instanceof Error ? error.message : String(error) },
				});
			}
			return;
		}
	}
}

function stripDataUrl(image: string): string {
	const commaIndex = image.indexOf(",");
	return image.startsWith("data:") && commaIndex >= 0 ? image.slice(commaIndex + 1) : image;
}