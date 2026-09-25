/**
 * CDP screenshot capture — fallback/agent-initiated screenshots against
 * Aside/Chrome started with `--remote-debugging-port=9222`.
 *
 * The extension's primary path is chrome.tabs.captureVisibleTab (no CDP);
 * this endpoint exists for captures requested by the agent itself.
 */

import type { ServerConfig } from "../config";

export interface CdpScreenshot {
	dataUrl: string;
	url: string;
	width: number;
	height: number;
	timestamp: number;
}

interface CdpTarget {
	id: string;
	type: string;
	title: string;
	url: string;
	webSocketDebuggerUrl?: string;
}

/** Discover CDP page targets. Throws when the debug port is not listening. */
export async function listTargets(cdpUrl: string): Promise<CdpTarget[]> {
	const response = await fetch(`${cdpUrl}/json/list`, { signal: AbortSignal.timeout(3000) });
	if (!response.ok) throw new Error(`CDP /json/list returned HTTP ${response.status}`);
	const targets = (await response.json()) as CdpTarget[];
	return targets.filter(t => t.type === "page");
}

/** Capture a PNG screenshot of the target matching `urlSubstring` (or the first page). */
export async function captureScreenshot(config: ServerConfig, urlSubstring?: string): Promise<CdpScreenshot> {
	const targets = await listTargets(config.cdpUrl);
	if (targets.length === 0) throw new Error("No CDP page targets — is the browser running with --remote-debugging-port?");

	const target = (urlSubstring ? targets.find(t => t.url.includes(urlSubstring)) : undefined) ?? targets[0];
	if (!target.webSocketDebuggerUrl) throw new Error("Target has no webSocketDebuggerUrl (browser restarted?)");

	const ws = new WebSocket(target.webSocketDebuggerUrl);
	const { promise, resolve, reject } = Promise.withResolvers<{ data: string; width: number; height: number }>();
	const timeout = setTimeout(() => {
		reject(new Error("CDP screenshot timed out"));
		ws.close();
	}, 15_000);

	ws.addEventListener("open", () => {
		ws.send(JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "png" } }));
	});
	ws.addEventListener("message", event => {
		try {
			const frame = JSON.parse(String(event.data)) as { id?: number; result?: { data?: string }; error?: unknown };
			if (frame.id === 1) {
				if (frame.result?.data) {
					// Follow up with layout metrics so the client knows dimensions.
					ws.send(JSON.stringify({ id: 2, method: "Page.getLayoutMetrics" }));
					resolve({ data: frame.result.data, width: 0, height: 0 });
				} else {
					reject(new Error(`CDP capture failed: ${JSON.stringify(frame.error ?? "no data")}`));
					ws.close();
				}
			}
			if (frame.id === 2) {
				ws.close();
			}
		} catch (error) {
			reject(error instanceof Error ? error : new Error(String(error)));
			ws.close();
		}
	});
	ws.addEventListener("error", () => {
		reject(new Error("CDP WebSocket connection failed"));
	});

	try {
		const result = await promise;
		return {
			dataUrl: `data:image/png;base64,${result.data}`,
			url: target.url,
			width: result.width,
			height: result.height,
			timestamp: Date.now(),
		};
	} finally {
		clearTimeout(timeout);
	}
}