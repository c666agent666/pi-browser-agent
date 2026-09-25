/**
 * Vision client — direct Ollama Cloud `/api/chat` call with a screenshot.
 * No pi SDK dependency: Bearer auth from OLLAMA_API_KEY (or ~/.ollama/auth.json),
 * standard Ollama message format with base64 `images`.
 *
 * Vision-capable models verified on the account: gemma4:31b (default),
 * qwen3.5:397b, kimi-k3.
 */

import { resolveOllamaApiKey, type ServerConfig } from "../config";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "https://ollama.com";

export interface VisionAnalysis {
	analysis: string;
	model: string;
}

/** Strip a data-URL prefix, returning raw base64 image bytes. */
function toBase64(image: string): string {
	const commaIndex = image.indexOf(",");
	if (image.startsWith("data:") && commaIndex >= 0) return image.slice(commaIndex + 1);
	return image;
}

export async function analyzeScreenshot(
	config: ServerConfig,
	image: string,
	prompt: string,
	modelOverride?: string,
): Promise<VisionAnalysis> {
	const apiKey = resolveOllamaApiKey();
	if (!apiKey) throw new Error("No Ollama Cloud API key — set OLLAMA_API_KEY or run /ollama-setup");

	const model = modelOverride ?? config.visionModel;
	const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages: [
				{
					role: "user",
					content: prompt,
					images: [toBase64(image)],
				},
			],
			stream: false,
		}),
		signal: AbortSignal.timeout(120_000),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Ollama Cloud /api/chat failed: HTTP ${response.status} ${body.slice(0, 300)}`);
	}

	const result = (await response.json()) as { message?: { content?: string }; error?: string };
	if (result.error) throw new Error(`Vision model error: ${result.error}`);

	return {
		analysis: result.message?.content ?? "(empty response)",
		model,
	};
}

/** List vision-capable models from the account catalog (GET /api/tags + /api/show). */
export async function listVisionModels(): Promise<string[]> {
	const apiKey = resolveOllamaApiKey();
	if (!apiKey) return [];

	const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) return [];

	const catalog = (await response.json()) as { models?: Array<{ name: string }> };
	const models = catalog.models ?? [];

	const visionModels = await Promise.all(
		models.map(async model => {
			try {
				const show = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${apiKey}`,
					},
					body: JSON.stringify({ model: model.name }),
					signal: AbortSignal.timeout(10_000),
				});
				if (!show.ok) return null;
				const details = (await show.json()) as { capabilities?: string[] };
				return details.capabilities?.includes("vision") ? model.name : null;
			} catch {
				return null;
			}
		}),
	);

	return visionModels.filter((name): name is string => name !== null);
}