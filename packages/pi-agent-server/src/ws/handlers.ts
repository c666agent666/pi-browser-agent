/**
 * WebSocket handlers — dispatches ClientMessage frames from the side panel.
 * One WS connection maps to one agent session (minted on upgrade).
 */

import type { ServerConfig } from "../config";
import type { SessionManager } from "../agent/session-manager";
import { captureScreenshot } from "../browser/cdp";
import { analyzeScreenshot, listVisionModels, modelHasVision, probeModel } from "../vision/ollama-vision";
import { loadSettings, saveSettings } from "../settings";
import { listConversations, deleteConversation, setConversationTitle } from "../agent/session-store";
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

/** Extract a { provider, modelId } summary from pi's Model object (defensively). */
function modelRef(model: unknown): { provider: string; modelId: string } | null {
	if (typeof model !== "object" || model === null) return null;
	const provider = (model as { provider?: unknown }).provider;
	const modelId = (model as { id?: unknown }).id ?? (model as { modelId?: unknown }).modelId;
	if (typeof modelId !== "string") return null;
	return { provider: typeof provider === "string" ? provider : "", modelId };
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
			let prompt = context ? `<page-context>\n${formatContextPrompt(context)}\n</page-context>\n\n${text}` : text;

			// First user message of this conversation becomes its title in the
		// history registry (set only once; no-op when the entry is absent).
			setConversationTitle(ctx.sessionId, text.replace(/\s+/g, " ").trim());

			// Auto-learn nudge, once per session: pi's standing autolearn guidance
			// already points at manage_skill; this makes the agent actively capture
			// lessons during its normal turn (pi's experimental post-stop capture
			// turn does not fire in RPC mode, and would cost an extra LLM call even
			// when it does).
			if (!session.autolearnReminderSent) {
				session.autolearnReminderSent = true;
				prompt += `\n\n<system-reminder>Auto-learn is active. If during this task you hit a failure you had to correct — a wrong path, a failed command, an unexpected result, an element that did not respond, an action you had to retry differently — that is a lesson. Capture it with the manage_skill tool (create a new managed skill, or enhance an existing one) BEFORE you finish, so future sessions avoid the same trap. Keep it to genuinely reusable lessons; skip it only for trivial tasks.</system-reminder>`;
			}

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
				const visionModel = model ?? loadSettings().visionModel ?? config.visionModel;
				if (!visionModel) {
					throw new Error("No vision model configured — pick one in settings");
				}
				const result = await analyzeScreenshot(visionModel, image, prompt);
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

		case "get_server_settings": {
			try {
				const settings = loadSettings();
				let activeModel: { provider: string; modelId: string } | null = null;
				try {
					const state = await session.client.send("get_state");
					if (state.success) activeModel = modelRef(state.data?.model);
				} catch {}
				ctx.send({
					type: "server_settings",
					requestId: message.requestId,
					payload: {
						visionModel: settings.visionModel ?? config.visionModel,
						interactionModel: settings.interactionModel ?? null,
						activeModel,
					},
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

		case "get_models": {
			try {
				const [piModels, vision] = await Promise.all([
					session.client
						.send("get_available_models")
						.then(response => {
							const models = (response.data?.models ?? []) as unknown[];
							const mapped: Array<{ provider: string; modelId: string; name?: string } | null> = models.map(m => {
								const ref = modelRef(m);
								if (!ref) return null;
								const name = (m as { name?: unknown }).name;
								return {
									provider: ref.provider,
									modelId: ref.modelId,
									name: typeof name === "string" ? name : undefined,
								};
							});
							return mapped.filter((m): m is { provider: string; modelId: string; name?: string } => m !== null);
						})
						.catch(() => [] as Array<{ provider: string; modelId: string; name?: string }>),
					listVisionModels(),
				]);
				ctx.send({
					type: "models",
					requestId: message.requestId,
					payload: { interaction: piModels, vision },
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

		case "set_interaction_model": {
			const { provider, modelId } = message.payload;
			try {
				const response = await session.client.send("set_model", { provider, modelId });
				if (!response.success) {
					ctx.send({
						type: "error",
						requestId: message.requestId,
						payload: { message: response.error ?? `pi rejected model ${provider}/${modelId}` },
					});
					return;
				}
				// Persist so future sessions spawn with this model.
				const settings = loadSettings();
				settings.interactionModel = { provider, modelId };
				saveSettings(settings);

				const active = modelRef(response.data);
				ctx.send({
					type: "server_settings",
					requestId: message.requestId,
					payload: {
						visionModel: settings.visionModel ?? config.visionModel,
						interactionModel: settings.interactionModel,
						activeModel: active,
					},
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

		case "set_vision_model": {
			const { model } = message.payload;
			try {
				if (!(await modelHasVision(model))) {
					ctx.send({
						type: "error",
						requestId: message.requestId,
						payload: {
							message: `Model "${model}" has no vision capability — pick one from the vision list`,
						},
					});
					return;
				}
				const settings = loadSettings();
				settings.visionModel = model;
				saveSettings(settings);

				let activeModel: { provider: string; modelId: string } | null = null;
				try {
					const state = await session.client.send("get_state");
					if (state.success) activeModel = modelRef(state.data?.model);
				} catch {}

				ctx.send({
					type: "server_settings",
					requestId: message.requestId,
					payload: {
						visionModel: model,
						interactionModel: settings.interactionModel ?? null,
						activeModel,
					},
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

		case "list_conversations": {
			ctx.send({
				type: "conversations",
				requestId: message.requestId,
				payload: { conversations: listConversations() },
			});
			return;
		}

		case "delete_conversation": {
			const { conversationId } = message.payload;
			const deleted = deleteConversation(conversationId);
			// If the active conversation was deleted, kill its subprocess too —
			// the client will switch to a fresh one.
			if (conversationId === ctx.sessionId) manager.destroySession(conversationId);
			ctx.send({
				type: "response",
				requestId: message.requestId,
				payload: { deleted },
			});
			return;
		}

		case "test_model": {
			const { model } = message.payload;
			if (!model.trim()) {
				ctx.send({ type: "error", requestId: message.requestId, payload: { message: "No model id given" } });
				return;
			}
			try {
				const probe = await probeModel(model.trim());
				ctx.send({
					type: "test_model_result",
					requestId: message.requestId,
					payload: { model: model.trim(), ...probe },
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