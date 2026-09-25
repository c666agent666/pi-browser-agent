/**
 * Background Service Worker
 *
 * Maintains persistent WebSocket connection to pi agent server.
 * Handles message routing between side panel, content scripts, and server.
 * Manages session lifecycle and reconnection.
 */

const SERVER_URL = "http://127.0.0.1:3848";
const WS_URL = "ws://127.0.0.1:3848/ws";

interface ServerMessage {
  type: string;
  payload: unknown;
  requestId?: string;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class PiAgentBackground {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageId = 0;
  private sidePanelPort: chrome.runtime.Port | null = null;
  private contentScriptPorts = new Map<number, chrome.runtime.Port>();

  constructor() {
    this.init();
  }

  private init(): void {
    // Listen for side panel connections
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === "sidepanel") {
        this.sidePanelPort = port;
        port.onDisconnect.addListener(() => {
          this.sidePanelPort = null;
        });
        port.onMessage.addListener((msg) => this.handleSidePanelMessage(msg));
        console.log("[PiAgent] Side panel connected");
      } else if (port.name === "content") {
        const tabId = port.sender?.tab?.id;
        if (tabId) {
          this.contentScriptPorts.set(tabId, port);
          port.onDisconnect.addListener(() => {
            this.contentScriptPorts.delete(tabId);
          });
          console.log(`[PiAgent] Content script connected: tab ${tabId}`);
        }
      }
    });

    // Listen for tab updates to inject content script if needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url?.startsWith("http")) {
        this.ensureContentScript(tabId);
      }
    });

    // Start connection
    this.connect();
  }

  private async ensureContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/index.js"],
      });
    } catch {
      // Already injected or error
    }
  }

  private connect(): void {
    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
    }

    const url = `${WS_URL}?sessionId=${this.sessionId}`;
    console.log(`[PiAgent] Connecting to ${url}`);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[PiAgent] WebSocket connected");
      this.reconnectAttempts = 0;
      this.sendToSidePanel({ type: "connected", payload: { sessionId: this.sessionId } });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (error) {
        console.error("[PiAgent] Failed to parse server message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("[PiAgent] WebSocket closed");
      this.sendToSidePanel({ type: "disconnected", payload: {} });
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[PiAgent] WebSocket error:", error);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[PiAgent] Max reconnect attempts reached");
      this.sendToSidePanel({ type: "error", payload: { message: "Connection lost. Please restart the server." } });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    console.log(`[PiAgent] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private handleServerMessage(msg: ServerMessage): void {
    // Handle request responses
    if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
      const pending = this.pendingRequests.get(msg.requestId)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(msg.requestId);

      if (msg.type === "error") {
        pending.reject(new Error(msg.payload as any));
      } else {
        pending.resolve(msg.payload);
      }
      return;
    }

    // Forward to side panel
    this.sendToSidePanel(msg);

    // Handle specific message types
    switch (msg.type) {
      case "approval_request":
        // Could show a notification here
        break;
      case "tool_call":
        // Could notify content script
        break;
    }
  }

  private handleSidePanelMessage(msg: any): void {
    // Add request ID for responses
    if (!msg.requestId) {
      msg.requestId = `req_${++this.messageId}`;
    }

    // Forward to server
    this.sendToServer(msg);

    // Handle local commands
    switch (msg.type) {
      case "get_page_context":
        this.getPageContext(msg.payload?.tabId).then((context) => {
          this.sendToSidePanel({
            type: "page_context",
            payload: context,
            requestId: msg.requestId,
          });
        });
        break;
      case "screenshot":
        this.captureScreenshot(msg.payload?.tabId).then((dataUrl) => {
          this.sendToSidePanel({
            type: "screenshot_result",
            payload: { dataUrl },
            requestId: msg.requestId,
          });
        });
        break;
    }
  }

  private sendToServer(msg: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn("[PiAgent] WS not connected, queuing message");
      // Could queue here
    }
  }

  private sendToSidePanel(msg: any): void {
    if (this.sidePanelPort) {
      this.sidePanelPort.postMessage(msg);
    }
  }

  private broadcastToContentScripts(msg: any): void {
    for (const port of this.contentScriptPorts.values()) {
      port.postMessage(msg);
    }
  }

  private async getPageContext(tabId?: number): Promise<any> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    if (!targetTabId) return null;

    return new Promise((resolve) => {
      const port = this.contentScriptPorts.get(targetTabId);
      if (!port) {
        resolve(null);
        return;
      }

      const requestId = `ctx_${Date.now()}`;
      const listener = (response: any) => {
        if (response.requestId === requestId) {
          port.onMessage.removeListener(listener);
          resolve(response.payload);
        }
      };
      port.onMessage.addListener(listener);
      port.postMessage({ type: "get_context", requestId });
      setTimeout(() => resolve(null), 5000);
    });
  }

  private async captureScreenshot(tabId?: number): Promise<string> {
    const targetTabId = tabId ?? (await this.getActiveTabId());
    if (!targetTabId) throw new Error("No active tab");

    // Use chrome.tabs.captureVisibleTab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    return dataUrl;
  }

  private async getActiveTabId(): Promise<number | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  }

  private generateSessionId(): string {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Initialize
new PiAgentBackground();

// Keep service worker alive
chrome.runtime.onMessage.addListener(() => true);

console.log("[PiAgent] Background service worker started");