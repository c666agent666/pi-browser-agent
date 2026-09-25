# Pi Browser Agent

A Chrome/Aside extension that brings the **Pi coding agent** into your browser as a side panel. Features real-time chat, tool approval UI, page context awareness, screenshots, and vision model analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Aside Browser (Chromium) / Chrome                              │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Web Page               │  │  Side Panel (Extension)     │  │
│  │                         │  │  ┌───────────────────────┐  │  │
│  │                         │  │  │  Pi Agent UI          │  │  │
│  │                         │  │  │  - Chat input         │  │  │
│  │                         │  │  │  - Tool calls/approval│  │  │
│  │                         │  │  │  - Session history    │  │  │
│  │                         │  │  │  - Page context       │  │  │
│  │                         │  │  │  - Screenshot + Vision│  │  │
│  │                         │  │  └───────────────────────┘  │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│          │                              │                       │
│          │ CDP / Extension APIs         │ WebSocket             │
│          ▼                              ▼                       │
└──────────┼──────────────────────────────┼───────────────────────┘
           │                              │
           ▼                              ▼
    ┌─────────────┐              ┌─────────────────┐
    │  Pi Agent   │◄────────────►│  Local HTTP     │
    │  (headless) │   MCP/WS     │  Server (Bun)   │
    │             │              │  Port 3848      │
    └─────────────┘              └─────────────────┘
           │
           ▼
    ┌─────────────┐
    │  File System│
    │  Tools, LSP │
    │  Git, etc.  │
    └─────────────┘
```

## Components

| Component | Description |
|-----------|-------------|
| **pi-agent-server** | Bun HTTP + WebSocket server that runs headless Pi agent sessions |
| **extension** | Manifest V3 Chrome/Aside extension with React side panel |
| **background** | Service worker maintaining persistent WS connection |
| **content script** | Extracts page context (DOM, selection, viewport) |

## Features

- 💬 **Chat with Pi** — Full agent capabilities in browser side panel
- 🔧 **Tool Approval UI** — Approve/deny bash, edit, write, task tools inline
- 📄 **Page Context** — Automatic DOM snapshot, selection, viewport, meta tags
- 📸 **Screenshots** — Capture visible tab via `chrome.tabs.captureVisibleTab`
- 🔍 **Vision Analysis** — Send screenshots to vision model (qwen2.5-vl, llama3.2-vision)
- 🔄 **Session Persistence** — Survives browser/extension restarts
- 🌐 **Aside + Chrome** — Works in both (Aside uses your logged-in sessions)

## Prerequisites

1. **Pi (omp)** installed and configured with Ollama Cloud: `/ollama-setup`
2. **Aside Browser** running with CDP: `--remote-debugging-port=9222`
3. **Vision model** configured in Ollama Cloud (qwen2.5-vl, llama3.2-vision, etc.)
4. **Bun** ≥ 1.1 for the server

## Quick Start

```bash
# Clone and install
cd pi-browser-agent
npm install

# Build extension
npm run build:extension

# Start server (terminal 1)
npm run dev:server

# Load extension in Chrome/Aside:
# 1. Open chrome://extensions (or aside://extensions)
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" → select `extension/dist`
# 4. Click extension icon → opens side panel
```

## Development

```bash
# Terminal 1: Server with hot reload
npm run dev:server

# Terminal 2: Extension with Vite HMR
npm run dev:extension
```

## Configuration

### Server (pi-agent-server)

Environment variables:
- `PORT` — Server port (default: 3848)
- `HOST` — Bind host (default: 127.0.0.1)
- `CDP_URL` — Chrome DevTools Protocol endpoint (default: http://127.0.0.1:9222)

### Extension

The extension connects to `http://127.0.0.1:3848` by default. To change, modify `WS_URL` and `HTTP_URL` in `extension/src/sidepanel/hooks/usePiAgent.ts`.

## Usage Examples

**Analyze current page:**
> "Summarize this page and extract all links"

**Vision analysis:**
1. Click 📸 to capture screenshot
2. Enter prompt: "Find all form fields and their validation rules"
3. Click Analyze

**Code automation:**
> "Create a React component based on the design in this page"

**Debug with context:**
> "Why is this button not working?" (includes selection + DOM)

## How Vision Works

1. User clicks 📸 → Extension captures visible tab via `chrome.tabs.captureVisibleTab`
2. Screenshot sent to server → Server forwards to Pi agent
3. Pi agent uses configured vision model (via Ollama Cloud) to analyze
4. Result streamed back to side panel as system message

Required: Vision model in Ollama Cloud (configured via `/ollama-setup` in Pi).

## Security

- Server binds to `127.0.0.1` only (not `0.0.0.0`)
- Extension `host_permissions` limited to localhost + active tab
- CSP restricts connections to local server only
- No data leaves your machine except to your configured Ollama Cloud

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Not connected" | Ensure server running on port 3848 |
| Screenshot fails | Check `CDP_URL` env var; ensure Aside/Chrome has `--remote-debugging-port=9222` |
| Vision errors | Verify vision model configured in Pi (`/ollama-setup`) |
| Extension won't load | Run `npm run build:extension` first; load `dist` folder |
| Tool approvals don't appear | Check server logs; ensure agent session is active |

## Project Structure

```
pi-browser-agent/
├── package.json                 # Workspace root
├── packages/
│   └── pi-agent-server/         # Bun HTTP + WS server
│       ├── package.json
│       └── src/server/index.ts  # Main server entry
└── extension/                   # Chrome/Aside extension (MV3)
    ├── package.json
    ├── vite.config.ts
    ├── manifest.json
    ├── tsconfig.json
    ├── public/
    │   └── icon.svg
    └── src/
        ├── background/index.ts  # Service worker
        ├── content/index.ts     # Content script
        └── sidepanel/           # React side panel
            ├── index.html
            ├── main.tsx
            ├── App.tsx
            ├── hooks/usePiAgent.ts
            ├── types.ts
            └── components/
                ├── MessageList.tsx
                ├── ToolCallCard.tsx
                ├── InputBar.tsx
                ├── PageContextPanel.tsx
                └── ScreenshotViewer.tsx
```

## License

MIT — Part of the Pi (oh-my-pi) ecosystem.