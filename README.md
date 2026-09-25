# Pi Browser Agent

A Chrome/Aside extension that brings the **[pi coding agent](https://github.com/can1357/oh-my-pi) (omp)** into your browser as a **terminal side panel** — chat, streaming tool activity, live page context, screenshots, vision analysis, **browser control**, and **session resume**.

**Status: v0.2.0 — working end-to-end**, all verified: chat round-trip through `omp --mode rpc`, session resume across server restarts (subprocess respawn + `switch_session` + history replay + conversational memory), Ollama Cloud vision (`gemma4:31b`), CDP target discovery, loadable MV3 build.

## How it works

The server is a **standalone bridge** — zero imports from the pi monorepo. It spawns the installed `omp` CLI in RPC mode and speaks its stdio JSON protocol, forwarding streaming agent events to the browser over WebSocket.

```
Side Panel (React, MV3)  ⇄  pi-agent-server (Bun)  ⇄  omp --mode rpc (subprocess)
   ↕ page context / screenshots        ↕
content script (DOM/selection)    CDP :9222 + Ollama Cloud vision
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and [PROTOCOL.md](PROTOCOL.md) for the wire contract.

## Features

- 🖥 **Terminal UI** — dark background, green/white monospace, blinking cursor, command history (↑), CRT scanlines
- 💬 **Chat with pi** — full agent capabilities (tools, MCP, skills) in the side panel
- 🌐 **Browser control** — type a task, the agent drives this browser (open pages, click, type, read) over CDP
- 🔁 **Session resume** — reconnect and even **restart the server**; the conversation continues from pi's session files, with full history replay
- 📡 **Live streaming** — assistant tokens and reasoning as they arrive
- 🔧 **Tool activity** — every tool call/result streamed with status (✓ / ✗ / ·)
- ⏹ **Abort control** — kill an in-flight turn mid-stream
- 📄 **Page context** — DOM snapshot, selection, viewport, meta tags attached per message (toggle [page-ctx])
- 📸 **Screenshots** — one click via `chrome.tabs.captureVisibleTab` (no CDP needed)
- 🔍 **Vision analysis** — screenshots analyzed by Ollama Cloud vision models (`gemma4:31b`, `qwen3.5:397b`, `kimi-k3`)
- 📡 **Status bar** — live WS + **CDP:ONLINE/OFF** indicator telling you when the agent can drive the browser

## Prerequisites

| Requirement | Notes |
|---|---|
| [pi (omp)](https://omp.sh) installed & configured | `/ollama-setup` for Ollama Cloud models |
| Bun ≥ 1.1 | Runs the server |
| Chrome 114+ or Aside | Side Panel API |
| `OLLAMA_API_KEY` | Vision feature (or `~/.ollama/auth.json`) |
| *(optional)* `--remote-debugging-port=9222` | Only for server-side CDP screenshots; extension screenshots don't need it |

## Browser control — the whole point

**Yes: you type a task, the agent executes it in your browser.** The spawned pi agent has pi's `browser` tool, which attaches to your Chrome/Aside over CDP (`browser.cdpUrl` in `~/.omp/agent/config.yml`) and can open pages, click, type, scroll and read — visibly, in your real browser profile, with your logins.

Examples to type in the panel:

```
open youtube.com and search for lofi hip hop
find my last unread email and summarize it
open github.com/notifications and list what's new
```

**Requirement:** the browser must be running with the CDP debug port. The status bar shows `CDP:ONLINE` (green) when it is:

```powershell
# Chrome
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Aside (close it first, including aside-daemon.exe)
Start-Process "C:\Program Files\Aside\Application\Aside.exe" -ArgumentList "--remote-debugging-port=9222"
```

With `CDP:OFF` everything else still works (chat, page context, screenshots, vision) — the agent just can't drive the browser. **Security:** the debug port is local-only, but any local process can control the browser while it's listening; launch it only when you want agent control.

## Session resume

Conversations survive both panel restarts and **server restarts**:

1. The server maps your `sessionId` to pi's on-disk session file (`~/.pi-browser-agent/sessions.json`)
2. On reconnect (even after the server died and respawned), it spawns a fresh `omp --mode rpc` and replays the stored session via `switch_session`
3. The panel receives a `history` frame and re-renders the conversation; the agent keeps full conversational memory

Verified: after a full server kill + restart, the resumed agent correctly recalled a word from before the restart.

## API keys & Ollama Cloud

| What | Key | Used by |
|---|---|---|
| **Agent models** (chat) | pi's own config — run `/ollama-setup` in `omp` once | `omp` subprocess |
| **Vision analysis** | `OLLAMA_API_KEY` env var (or `~/.ollama/auth.json`) | server `/api/vision` |
| **Web search** (for the agent) | pi's Ollama Cloud link (`/ollama-setup`) | `omp` subprocess |

- You normally **don't paste any key into the extension** — it talks only to the local server, and the server already has env access.
- Get a key at **ollama.com → Settings → API Keys**; set it with `setx OLLAMA_API_KEY "<key>"` (new terminals) or in your shell profile.
- Web search/fetch: once pi's Ollama Cloud link is set up (`/ollama-setup`), the agent can search the web from the side panel too — just ask.
- Check vision models on your account: `curl -H "Authorization: Bearer $OLLAMA_API_KEY" http://127.0.0.1:3848/api/vision/models` (server-proxied) or `https://ollama.com/api/tags` directly.

## Versions

Releases are tagged on GitHub (`git tag` + [github.com/c666agent666/pi-browser-agent/releases](https://github.com/c666agent666/pi-browser-agent/releases)) with full changelogs. Current: **v0.2.0**.

## Quick start

### One-click launch (Windows)

Double-click one of these — they start the server if needed and launch the browser with browser control armed:

```
C:\Users\i\pi-browser-agent\START-ASIDE.cmd     (also copied to your Desktop)
C:\Users\i\pi-browser-agent\START-CHROME.cmd
```

First time only — load the extension inside the browser (3 clicks):

1. `aside://extensions` (or `chrome://extensions`)
2. Toggle **Developer mode** ON
3. **Load unpacked** → `C:\Users\i\pi-browser-agent\extension\dist`

Then click the green `>_` toolbar icon to open the terminal side panel. Look for `WS:OK` + `CDP:ONLINE` in the status bar.

### Manual launch

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
- **Browser control needs the debug flag:** without `--remote-debugging-port=9222`
  the agent can't drive the browser (status bar shows `CDP:OFF`); everything
  else works.
- **Force-killed servers:** the graceful path (Ctrl+C / SIGINT) closes all agent
  subprocesses; if the server itself is `taskkill /F`-ed, `omp` children can be
  orphaned on Windows.

## License

MIT