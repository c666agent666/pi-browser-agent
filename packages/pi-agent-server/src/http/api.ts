/**
 * REST API routes (non-WS). CORS-open for the extension origin.
 */

import type { ServerConfig } from "../config";
import { listTargets } from "../browser/cdp";
import { analyzeScreenshot, listVisionModels } from "../vision/ollama-vision";
import { loadSettings } from "../settings";

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "Content-Type": "application/json", ...CORS_HEADERS },
	});
}

export async function handleApi(request: Request, path: string, config: ServerConfig, sessionIds: () => string[]): Promise<Response> {
	// GET /api/health
	if (path === "/api/health" && request.method === "GET") {
		return json({
			status: "ok",
			sessions: sessionIds().length,
			cdp: config.cdpUrl,
			visionModel: loadSettings().visionModel ?? config.visionModel,
		});
	}

	// GET /api/sessions
	if (path === "/api/sessions" && request.method === "GET") {
		return json({ sessions: sessionIds() });
	}

	// GET /api/cdp/targets — is the debug port alive?
	if (path === "/api/cdp/targets" && request.method === "GET") {
		try {
			const targets = await listTargets(config.cdpUrl);
			return json({ ok: true, targets: targets.map(t => ({ title: t.title, url: t.url })) });
		} catch (error) {
			return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 502);
		}
	}

	// GET /api/vision/models — vision-capable models on the account
	if (path === "/api/vision/models" && request.method === "GET") {
		try {
			return json({ models: await listVisionModels() });
		} catch (error) {
			return json({ error: error instanceof Error ? error.message : String(error) }, 502);
		}
	}

	// POST /api/vision — analyze a base64/data-URL screenshot
	if (path === "/api/vision" && request.method === "POST") {
		try {
			const body = (await request.json()) as { image?: string; prompt?: string; model?: string };
			if (!body.image || !body.prompt) return json({ error: "image and prompt required" }, 400);
			const visionModel = body.model ?? loadSettings().visionModel ?? config.visionModel;
			if (!visionModel) return json({ error: "No vision model configured" }, 400);
			const result = await analyzeScreenshot(visionModel, body.image, body.prompt);
			return json(result);
		} catch (error) {
			return json({ error: error instanceof Error ? error.message : String(error) }, 500);
		}
	}

	return json({ error: "Not found" }, 404);
}