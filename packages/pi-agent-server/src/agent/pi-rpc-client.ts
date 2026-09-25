/**
 * pi RPC client — spawns `omp --mode rpc` and speaks its stdio protocol.
 *
 * Protocol (newline-delimited JSON on stdin/stdout):
 *  - omp → us: `ready`, `response` (correlated by `id`), verbatim `AgentEvent`s
 *  - us → omp: `negotiate_protocol`, `prompt`, `abort`, `new_session`, `get_state`, …
 *
 * We deliberately stay on protocol v1 (1 MiB frames, no chunk reassembly).
 */

import type { FileSink, Subprocess } from "bun";
import type { ServerConfig } from "../config";

/** Frames that correlate to a request we sent. */
export interface RpcResponseFrame {
	type: "response";
	id?: string;
	command: string;
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
}

/** An `AgentEvent` streamed by the session — forwarded verbatim. */
export interface AgentEventFrame {
	type: string;
	[key: string]: unknown;
}

export type PiEvent = AgentEventFrame | RpcResponseFrame;

interface PendingCommand {
	resolve: (frame: RpcResponseFrame) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}

export class PiRpcClient {
	readonly subprocess: Subprocess;
	#stdin: FileSink | null = null;
	#pending = new Map<string, PendingCommand>();
	#nextId = 0;
	#closed = false;
	#onEvent: ((event: PiEvent) => void) | null = null;
	#onExit: (() => void) | null = null;
	readonly #ready = Promise.withResolvers<void>();

	constructor(
		private readonly config: ServerConfig,
	) {
		this.subprocess = Bun.spawn([config.ompBinary, "--mode", "rpc"], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			cwd: config.agentCwd,
			env: { ...process.env, PI_NOTIFICATIONS: "off", NO_COLOR: "1" },
		});
		void this.#readLoop();
		void this.#drainStderr();
		this.subprocess.exited.then(code => {
			this.#closed = true;
			for (const pending of this.#pending.values()) {
				clearTimeout(pending.timeout);
				pending.reject(new Error(`pi exited (code ${code})`));
			}
			this.#pending.clear();
			this.#onExit?.();
		});
	}

	get alive(): boolean {
		return !this.#closed && this.subprocess.exitCode === null;
	}

	set onEvent(listener: (event: PiEvent) => void) {
		this.#onEvent = listener;
	}

	set onExit(listener: () => void) {
		this.#onExit = listener;
	}

	/** Resolves once the `ready` frame has been seen (or rejects on death/timeout). */
	waitReady(timeoutMs = 30_000): Promise<void> {
		return Promise.race([
			this.#ready.promise,
			this.subprocess.exited.then(() => {
				throw new Error("pi process died before sending ready frame");
			}),
			Bun.sleep(timeoutMs).then(() => {
				throw new Error("pi did not send a ready frame in time");
			}),
		]);
	}

	/** Send a command and await its correlated `response` frame. */
	async send(command: string, params: Record<string, unknown> = {}): Promise<RpcResponseFrame> {
		if (!this.alive) throw new Error("pi process is not running");
		const id = `srv_${this.#nextId++}`;
		const frame = { id, type: command, ...params };

		const { promise, resolve, reject } = Promise.withResolvers<RpcResponseFrame>();
		const timeout = setTimeout(() => {
			this.#pending.delete(id);
			reject(new Error(`pi RPC command '${command}' timed out`));
		}, this.config.rpcTimeoutMs);
		this.#pending.set(id, { resolve, reject, timeout });

		try {
			await this.#writeLine(JSON.stringify(frame));
		} catch (error) {
			this.#pending.delete(id);
			clearTimeout(timeout);
			reject(error instanceof Error ? error : new Error(String(error)));
		}
		return promise;
	}

	/** Fire-and-forget frame (e.g. `abort`). */
	async notify(command: string, params: Record<string, unknown> = {}): Promise<void> {
		await this.#writeLine(JSON.stringify({ type: command, ...params }));
	}

	async close(): Promise<void> {
		if (this.#closed) return;
		this.#stdin?.end();
		try {
			await Promise.race([this.subprocess.exited, Bun.sleep(3000)]);
		} catch {}
		if (this.subprocess.exitCode === null) this.subprocess.kill();
		this.#closed = true;
	}

	async #writeLine(line: string): Promise<void> {
		const stdin = this.#stdin ?? (this.#stdin = this.subprocess.stdin as FileSink);
		stdin.write(line + "\n");
	}

	async #drainStderr(): Promise<void> {
		const reader = (this.subprocess.stderr as ReadableStream<Uint8Array>).getReader();
		try {
			for (;;) await reader.read();
		} catch {}
	}

	async #readLoop(): Promise<void> {
		const reader = (this.subprocess.stdout as ReadableStream<Uint8Array>).getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				let newlineIndex: number;
				while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
					const line = buffer.slice(0, newlineIndex);
					buffer = buffer.slice(newlineIndex + 1);
					if (!line.trim()) continue;
					this.#dispatchLine(line);
				}
			}
		} catch {
			// stdout closed — the exited handler takes over
		}
	}

	#dispatchLine(line: string): void {
		let frame: Record<string, unknown>;
		try {
			frame = JSON.parse(line) as Record<string, unknown>;
		} catch {
			console.error(`[pi-rpc] non-JSON stdout line: ${line.slice(0, 200)}`);
			return;
		}

		const type = typeof frame.type === "string" ? frame.type : "";

		if (type === "ready") {
			this.#ready.resolve();
			return;
		}

		if (type === "response") {
			const response = frame as unknown as RpcResponseFrame;
			const id = response.id;
			if (id !== undefined) {
				const pending = this.#pending.get(id);
				if (pending) {
					this.#pending.delete(id);
					clearTimeout(pending.timeout);
					pending.resolve(response);
					return;
				}
			}
			this.#onEvent?.(response);
			return;
		}

		if (type === "rpc_chunk") {
			// Protocol v2 chunking — we never negotiate v2; ignore.
			return;
		}

		// Everything else is an AgentEvent (agent_start, message_update,
		// tool_execution_start, …) — forward verbatim.
		this.#onEvent?.(frame as AgentEventFrame);
	}
}