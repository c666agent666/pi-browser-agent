# Pi Browser Agent

A Chrome/Aside extension that brings the **[pi coding agent](https://github.com/can1357/oh-my-pi) (omp)** into your browser as a side panel: real-time chat, streaming tool activity, live page context, screenshots, and vision-model analysis.

**Status: working end-to-end** — verified chat round-trip through `omp --mode rpc`, Ollama Cloud vision analysis (`gemma4:31b`), and CDP target discovery.

## How it works

The server is a **standalone bridge** — zero imports from the pi monorepo. It spawns the installed `omp` CLI in RPC mode and speaks its stdio JSON protocol, forwarding streaming agent events to the browser over WebSocket.

```
Side Panel (React, MV3)  ⇄  pi-agent-server (Bun)  ⇄  omp --mode rpc (subprocess)
   ↕ page context / screenshots        ↕
content script (DOM/selection)    CDP :9222 + Ollama Cloud vision
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and [PROTOCOL.md](PROTOCOL.md) for the wire contract.

## Features

- 💬 **Chat with pi** — full agent capabilities (tools, MCP, skills) in the side panel
- 📡 **Live streaming** — assistant tokens and reasoning as they arrive
- 🔧 **Tool activity** — every tool call/result streamed with status (⚙ running / ✓ / ✕)
- ⏹ **Abort control** — kill an in-flight turn mid-stream
- 📄 **Page context** — DOM snapshot, selection, viewport, meta tags attached per message (toggle 🔗)
- 📸 **Screenshots** — one click via `chrome.tabs.captureVisibleTab` (no CDP needed)
- 🔍 **Vision analysis** — screenshots analyzed by Ollama Cloud vision models (`gemma4:31b`, `qwen3.5:397b`, `kimi-k3`)
- 🔁 **Session persistence** — reconnect to a live agent session across panel close/open

## Prerequisites

| Requirement | Notes |
|---|---|
| [pi (omp)](https://omp.sh) installed & configured | `/ollama-setup` for Ollama Cloud models |
| Bun ≥ 1.1 | Runs the server |
| Chrome 114+ or Aside | Side Panel API |
| `OLLAMA_API_KEY` | Vision feature (or `~/.ollama/auth.json`) |
| *(optional)* `--remote-debugging-port=9222` | Only for server-side CDP screenshots; extension screenshots don't need it |

## Quick start

```bash
git clone <this-repo> && cd pi-browser-agent
bun install

# Terminal 1: server
bun run dev:server

# Terminal 2: extension build
bun install && bun run build:extension
```

Then in Chrome/Aside:
1. `chrome://extensions` (or `aside://extensions`) → enable **Developer mode**
2. **Load unpacked** → select `extension/dist`
3. Open the side panel (extension icon, or right-click page → "Open side panel")

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3848` | Server port |
| `PI_BINARY` | `omp` | pi CLI binary |
| `AGENT_CWD` | server cwd | Working directory for agent sessions |
| `CDP_URL` | `http://127.0.0.1:9222` | CDP debug port (server-side screenshots) |
| `VISION_MODEL` | `gemma4:31b` | Default Ollama Cloud vision model |
| `OLLAMA_API_KEY` | — | Vision auth |
| `IDLE_TIMEOUT_MS` | `1800000` | Kill idle agent subprocess after this |

## Smoke tests

```bash
bun run check                          # typecheck server + extension
bun packages/pi-agent-server/src/index.ts &   # start server
bun scripts/smoke-client.ts            # full chat round-trip through omp
curl http://127.0.0.1:3848/api/vision/models  # vision models on account
```

## Project structure

```
pi-browser-agent/
├── ARCHITECTURE.md
├── PROTOCOL.md
├── scripts/smoke-client.ts           # end-to-end WS test client
├── packages/pi-agent-server/src/
│   ├── index.ts                      # Bun.serve entry (HTTP + WS)
│   ├── config.ts                     # env config
│   ├── types.ts                      # wire protocol types
│   ├── agent/
│   │   ├── pi-rpc-client.ts          # spawn omp --mode rpc, framing, correlation
│   │   ├── session-manager.ts         # registry, respawn, idle shutdown
│   │   └── event-bridge.ts           # AgentEvents → WS frames
│   ├── browser/cdp.ts                # CDP screenshot capture
│   ├── vision/ollama-vision.ts       # Ollama Cloud /api/chat vision
│   ├── http/api.ts                   # REST routes
│   └── ws/handlers.ts                # WS message dispatch
└── extension/src/
    ├── background/index.ts           # relay only (no WS — MV3 kills idle workers)
    ├── content/index.ts              # page context extraction
    └── sidepanel/
        ├── App.tsx
        ├── hooks/usePiAgent.ts       # owns the WS connection
        ├── hooks/usePageContext.ts   # context refresh + screenshots
        └── components/…             # chat list, tool cards, screenshot viewer
```

## Known limitations

- **Tool approvals:** pi's RPC mode doesn't expose interactive approval over the
  wire yet — the panel shows live tool activity + Abort instead. The protocol
  reserves `approval_request` for when pi adds it.
- **History across restarts:** a fresh subprocess starts a fresh conversation;
  reconnecting while the subprocess lives resumes it. (Resuming from pi session
  files via `switch_session` is planned.)

## License

MIT