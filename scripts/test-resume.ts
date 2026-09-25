/**
 * Resume smoke test:
 *  1. connect (new session) → chat "remember the word banana" → disconnect
 *  2. reconnect same sessionId → expect connected{resumed:true} + history with banana
 * Prints PASS/FAIL lines; exits non-zero on failure.
 */

const WS_URL = "ws://127.0.0.1:3848/ws";

function connect(sessionId?: string): WebSocket {
	return new WebSocket(sessionId ? `${WS_URL}?sessionId=${encodeURIComponent(sessionId)}` : WS_URL);
}

function run(socket: WebSocket, script: (frame: any) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const fail = setTimeout(() => reject(new Error("test timeout")), 120_000);
		socket.onmessage = event => {
			const frame = JSON.parse(String(event.data));
			try {
				script(frame);
			} catch (error) {
				clearTimeout(fail);
				reject(error);
			}
		};
		socket.onerror = () => {
			clearTimeout(fail);
			reject(new Error("socket error"));
		};
		socket.onclose = () => {
			clearTimeout(fail);
			resolve();
		};
	});
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── phase 1: fresh session with a memorable fact ─────────────────────────
const phase1 = connect();
let sessionId: string | undefined;

await run(phase1, frame => {
	if (frame.type === "connected" && !frame.payload.resumed) {
		sessionId = frame.payload.sessionId;
		console.log(`[1] new session: ${sessionId}`);
		phase1.send(JSON.stringify({
			type: "chat",
			requestId: "r1",
			payload: { message: "Remember this word for later: banana. Reply with just: ok" },
		}));
	} else if (frame.type === "assistant_token") {
		process.stdout.write(frame.payload.delta ?? "");
	} else if (frame.type === "turn_end") {
		console.log("\n[1] turn complete — disconnecting");
		phase1.close();
		throw new Error("__done__");
	}
}).catch(() => {}); // "__done__" thrown to exit the loop

if (!sessionId) throw new Error("no session id from phase 1");
await sleep(2000);

// ── phase 2: reconnect → expect resume + history replay ──────────────────
const phase2 = connect(sessionId);
let sawHistory = false;

await run(phase2, frame => {
	if (frame.type === "connected") {
		console.log(`[2] reconnected resumed=${frame.payload.resumed}`);
		if (!frame.payload.resumed) throw new Error("FAIL: expected resumed=true");
	} else if (frame.type === "history") {
		sawHistory = true;
		const texts = frame.payload.messages.map((m: any) => m.text).join("\n");
		const hasBanana = texts.includes("banana");
		console.log(`[2] history: ${frame.payload.messages.length} messages, banana=${hasBanana ? "found" : "MISSING"}`);
		if (!hasBanana) throw new Error("FAIL: banana not in replayed history");
		phase2.close();
		throw new Error("__done__");
	}
}).catch(() => {});

if (!sawHistory) throw new Error("FAIL: no history frame received");
console.log("PASS: session resume works (reconnect + history replay)");