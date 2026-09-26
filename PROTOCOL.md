# Wire Protocol

Contract between the extension side panel and the pi-browser-agent server.
All frames are single JSON objects. WebSocket: `ws://127.0.0.1:3848/ws?sessionId=<optional>`.

The TypeScript source of truth lives in `packages/pi-agent-server/src/types.ts`
and is mirrored in `extension/src/sidepanel/types.ts` — keep both in sync.

## Connection lifecycle

1. Panel opens WS, optionally passing a `sessionId` remembered from a previous
   connection.
2. Server creates (or respawns, if the subprocess died) a session and sends:

```json
{ "type": "connected", "payload": { "sessionId": "sess_…", "resumed": true } }
```

3. `resumed: false` means the panel's history is gone (fresh `omp` subprocess).
4. On WS close, the server arms an idle shutdown (`IDLE_TIMEOUT_MS`, default
   30 min) for the session's subprocess.

## Client → Server

| Frame | Purpose |
|---|---|
| `{ type: "chat", requestId, payload: { message, context?, images? } }` | Send a prompt. `context` is a `PageContextSummary` (URL/title/selection/DOM snapshot) prepended to the message inside `<page-context>`. `images` are base64 data URLs. |
| `{ type: "abort", requestId }` | Abort the in-flight turn. |
| `{ type: "new_session", requestId }` | Start a fresh pi conversation (same subprocess). |
| `{ type: "get_state", requestId }` | Pi session state (model, streaming flags, message count…). |
| `{ type: "get_server_settings", requestId }` | Current interaction + vision model. |
| `{ type: "get_models", requestId }` | Live interaction model list (pi catalog) + vision-capable models (Ollama Cloud). |
| `{ type: "set_interaction_model", requestId, payload: { provider, modelId } }` | Change the agent's model (pi `set_model`); persisted and re-applied to new sessions. |
| `{ type: "set_vision_model", requestId, payload: { model } }` | Change the vision model; rejected unless the model is vision-capable (validated live). |
| `{ type: "screenshot", requestId, payload: { url? } }` | Server-side CDP capture of the matching tab. |
| `{ type: "vision", requestId, payload: { image, prompt, model? } }` | Analyze `image` (base64 or data URL) with an Ollama Cloud vision model. |
| `{ type: "ping" }` | Liveness ping. |

## Server → Client

| Frame | Purpose |
|---|---|
| `connected` | Session established; `resumed` flags whether history survived. |
| `response` + `requestId` | Request ack/completion (e.g. `{ accepted: true }`). |
| `history` | Replayed conversation after a resume: `{ messages: [{ id, role, text }] }` (user/assistant text only, last 100). |
| `server_settings` + `requestId` | Live model state: `{ visionModel, interactionModel?, activeModel? }`. Sent in reply to `get_server_settings`, `set_interaction_model`, `set_vision_model`. |
| `models` + `requestId` | Live lists: `{ interaction: [{ provider, modelId, name? }], vision: [string] }` — nothing hardcoded. |
| `assistant_token` | Streaming assistant text: `delta` (increment) and `text` (cumulative). |
| `thinking_token` | Streaming reasoning text (increment only). |
| `tool_call` | Tool activity: `{ id, name, args, status: running|completed|failed }`. Emitted on both `toolcall_end` (planned call) and `tool_execution_start/end`. |
| `tool_result` | `{ id, name, result, isError }`. |
| `turn_end` | The assistant finished its turn. |
| `screenshot_result` + `requestId` | CDP capture (dataUrl PNG). |
| `vision_result` + `requestId` | `{ analysis, model }`. |
| `approval_request` | **Reserved.** pi's RPC mode does not expose interactive tool approval yet. |
| `error` (`requestId?`) | Error surfaced to the UI. |
| `pong` | Liveness reply. |

## REST

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Server status + session count. |
| `GET /api/sessions` | Active session ids. |
| `GET /api/cdp/targets` | Whether the CDP debug port is alive, and open tabs. |
| `GET /api/vision/models` | Vision-capable models on the Ollama Cloud account. |
| `POST /api/vision` | `{ image, prompt, model? }` → `{ analysis, model }`. |

## Notes

- **Tool approvals:** pi RPC mode currently runs with its configured
  permissions; the panel shows live tool activity and can abort mid-turn.
  When pi exposes approval over RPC, `approval_request` will be emitted
  without a protocol change.
- **Frame size:** pi RPC protocol v1 caps stdio frames at 1 MiB; the server
  does not negotiate v2 chunking.