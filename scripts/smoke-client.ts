/** One-shot WS smoke client: connect, chat, print frames until turn_end. */

const ws = new WebSocket("ws://127.0.0.1:3848/ws");
const timeout = setTimeout(() => { console.error("TIMEOUT"); process.exit(1); }, 90_000);

ws.onopen = () => {
	console.log("[client] connected");
};

ws.onmessage = event => {
	const frame = JSON.parse(String(event.data));
	switch (frame.type) {
		case "connected":
			console.log(`[client] session=${frame.payload.sessionId} resumed=${frame.payload.resumed}`);
			ws.send(JSON.stringify({
				type: "chat",
				requestId: "req_1",
				payload: {
					message: "Reply with exactly the words: hello from pi, nothing else.",
					context: { url: "https://example.com", title: "Smoke Test" },
				},
			}));
			break;
		case "assistant_token":
			process.stdout.write(frame.payload.text ? "" : "");
			if (frame.payload.delta) process.stdout.write(frame.payload.delta);
			break;
		case "thinking_token":
			break; // ignore
		case "tool_call":
			console.log(`\n[client] tool: ${frame.payload.name} (${frame.payload.status})`);
			break;
		case "tool_result":
			console.log(`[client] tool result ${frame.payload.name} isError=${frame.payload.isError}`);
			break;
		case "turn_end":
			console.log("\n[client] turn complete");
			clearTimeout(timeout);
			ws.close();
			process.exit(0);
		case "error":
			console.error("[client] server error:", frame.payload);
			clearTimeout(timeout);
			process.exit(1);
		case "response":
			console.log(`[client] response for ${frame.requestId}:`, frame.payload);
			break;
	}
};

ws.onerror = error => {
	console.error("[client] ws error", error);
	clearTimeout(timeout);
	process.exit(1);
};