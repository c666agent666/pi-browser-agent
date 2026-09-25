# Architecture

## Overview

```
┌────────────────────────────────────────────────────────────────────┐
│ Chrome / Aside (Chromium, MV3)                                      │
│                                                                    │
│  ┌──────────────────┐   chrome.runtime    ┌──────────────────────┐ │
│  │ Content Script   │◄──────────────────►│ Background SW        │ │
│  │ (DOM/selection) │   (port relay)      │ (relay only, no WS)  │ │
│  └────────▲─────────┘                    └──────────▲───────────┘ │
│           │ chrome.tabs.sendMessage                │             │
│  ┌────────┴────────────────────────────────────────┴───────────┐ │
│  │ Side Panel (React)                                          │ │
│  │ - owns the WebSocket connection to the server                │ │
│  │ - screenshots via chrome.tabs.captureVisibleTab              │ │
│  │ - chat UI, live tool activity, abort control                 │ │
│  └────────────────────────────┬─────────────────────────────────┘ │
└───────────────────────────────┼────────────────────────────────────┘
                                │ WebSocket (ws://127.0.0.1:3848/ws)
                                │ + REST (screenshot/vision/health)
┌───────────────────────────────▼────────────────────────────────────┐
│ pi-agent-server (Bun, standalone — zero pi imports)                 │
│                                                                    │
│  src/agent/      session-manager ──► pi-rpc-client ──► spawn:      │
│  src/http/                            `omp --mode rpc` (stdio JSON)│
│  src/ws/                                                           │
│  src/browser/    cdp.ts ─── CDP :9222 (Aside/Chrome debug port)    │
│  src/vision/     ollama-vision.ts ─── Ollama Cloud /api/chat       │
│                   (Bearer OLLAMA_API_KEY, vision-capable models)   │
└────────────────────────────────────────────────────────────────────┘
```

## Key decisions

1. **Subprocess bridge, not SDK import.** The pi monorepo uses workspace
   catalogs (`catalog:` protocol deps) that cannot resolve from a standalone
   repo. Instead of importing `@oh-my-pi/*`, the server spawns the installed
   `omp` CLI in RPC mode (`omp --mode rpc`) and speaks its documented
   newline-delimited JSON protocol over stdio. This decouples the two
   release cycles entirely.

2. **Side panel owns the connection.** MV3 service workers are terminated
   by Chrome after ~30s idle, so a persistent WebSocket there is
   unreliable. The side panel connects directly; its lifetime matches the
   connection lifetime. The background worker only relays page context
   between content scripts and the panel.

3. **Two screenshot paths.**
   - Extension path (primary): `chrome.tabs.captureVisibleTab` — no CDP
     required, works on any page the user has open.
   - Server path (fallback/agent-initiated): CDP against
     `--remote-debugging-port=9222` (Aside started with the debug flag),
     `Page.captureScreenshot`.

4. **Vision without pi.** The vision client calls Ollama Cloud
   `/api/chat` directly with the `OLLAMA_API_KEY` env var, sending the
   screenshot as a base64 `images` entry. Vision-capable models verified on
   the account: `gemma4:31b` (default), `qwen3.5:397b`, `kimi-k3`.

5. **Approval story (v1).** pi's RPC mode does not expose interactive
   tool approval over the wire. v1 surfaces live tool activity
   (`tool_call` / `tool_result` frames) plus an **Abort** control (the
   `abort` RPC command). The WS protocol reserves `approval_request` /
   `approval_response` for forward compatibility.

6. **Session identity.** The server mints `sessionId`s; the client
   persists one in `localStorage` and reconnects with it. If the backing
   subprocess died while the panel was closed, the server respawns a
   fresh one and reports `connected { resumed: false }`. (Resuming from
   pi session files via `switch_session` is a documented TODO.)

## pi RPC protocol (what the bridge speaks)

Spawned process frames (newline-delimited JSON on stdio):

- **omp → server:** `ready` (protocol negotiation info), `response`
  (correlated by `id`), and verbatim `AgentEvent`s:
  `agent_start`, `turn_start`, `message_start`,
  `message_update` (with `assistantMessageEvent.text_delta` /
  `thinking_delta` / `toolcall_end`), `message_end`,
  `tool_execution_start|update|end`, `turn_end`, `agent_end`.
- **server → omp:** `negotiate_protocol`, `prompt`, `abort`,
  `new_session`, `get_state`, …

Protocol v1 only (1 MiB frames) is used — chunked v2 reassembly is not
needed for chat-sized frames and is left un-negotiated.

## Extension protocol

See [PROTOCOL.md](PROTOCOL.md) for the full WebSocket + REST contract.