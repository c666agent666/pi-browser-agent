/**
 * Vision client — direct Ollama Cloud `/api/chat` call with a screenshot.
 * No pi SDK dependency: Bearer auth from OLLAMA_API_KEY (or ~/.ollama/auth.json),
 * standard Ollama message format with base64 `images`.
 *
 * Nothing is hardcoded: the vision model is stored in server settings and
 * validated against the live catalog (`/api/show` capabilities) before use.
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

export async function modelHasVision(model: string): Promise<boolean> {
	return (await probeModel(model)).capabilities.includes("vision");
}

export interface ModelProbe {
	exists: boolean;
	capabilities: string[];
	/** Live one-shot chat probe. */
	liveTest: { ok: boolean; reply: string; latencyMs: number; error?: string };
}

/**
 * Probe a model against the REAL Ollama Cloud account:
 *  1. POST /api/show — does it exist, what can it do (capabilities)?
 *  2. POST /api/chat — a real one-shot request proving it actually answers.
 */
export async function probeModel(model: string): Promise<ModelProbe> {
	const apiKey = resolveOllamaApiKey();
	if (!apiKey) {
		return {
			exists: false,
			capabilities: [],
			liveTest: { ok: false, reply: "", latencyMs: 0, error: "No OLLAMA_API_KEY configured" },
		};
	}

	// 1. Existence + capabilities
	let exists = false;
	let capabilities: string[] = [];
	try {
		const show = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({ model }),
			signal: AbortSignal.timeout(15_000),
		});
		if (show.ok) {
			const details = (await show.json()) as { capabilities?: string[]; error?: string };
			if (!details.error) {
				exists = true;
				capabilities = details.capabilities ?? [];
		}
		}
	} catch {}

	// 2. Live chat probe — the actual proof the model works on this account
	const started = Date.now();
	try {
		const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				messages: [{ role: "user", content: "Reply with exactly: OK" }],
				stream: false,
			options: { num_predict: 20 },
		}),
			signal: AbortSignal.timeout(60_000),
		});
		if (!response.ok) {
			const body = await response.text().catch(() => "");
			return {
				exists,
				capabilities,
				liveTest: {
					ok: false,
					reply: "",
					latencyMs: Date.now() - started,
					error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
				},
			};
		}
		const result = (await response.json()) as { message?: { content?: string }; error?: string };
		if (result.error) {
			return {
				exists,
				capabilities,
				liveTest: {
					ok: false,
					reply: "",
					latencyMs: Date.now() - started,
						error: result.error,
				},
			};
		}
		return {
			exists,
			capabilities,
			liveTest: {
				ok: true,
				reply: result.message?.content ?? "(empty reply)",
				latencyMs: Date.now() - started,
			},
		};
	} catch (error) {
		return {
			exists,
			capabilities,
			liveTest: {
				ok: false,
				reply: "",
				latencyMs: Date.now() - started,
				error: error instanceof Error ? error.message : String(error),
		},
		};
	}
}

/** List vision-capable models from the account catalog (GET /api/tags + POST /api/show). */
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
		models.map(async model => ((await modelHasVision(model.name)) ? model.name : null)),
	);
	return visionModels.filter((name): name is string => name !== null);
}

export async function analyzeScreenshot(
	model: string,
	image: string,
	prompt: string,
): Promise<VisionAnalysis> {
	const apiKey = resolveOllamaApiKey();
	if (!apiKey) throw new Error("No Ollama Cloud API key — set OLLAMA_API_KEY or run /ollama-setup");

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