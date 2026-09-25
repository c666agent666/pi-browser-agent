/**
 * Content Script
 *
 * Runs in page context. Extracts DOM, selection, viewport info.
 * Communicates with background via Port.
 */

interface PageContext {
  url: string;
  title: string;
  selection: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  domSnapshot: string; // Simplified DOM for context
  meta: Record<string, string>;
}

class PiAgentContentScript {
  private port: chrome.runtime.Port | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Connect to background
    this.port = chrome.runtime.connect({ name: "content" });
    this.port.onMessage.addListener((msg) => this.handleMessage(msg));
    this.port.onDisconnect.addListener(() => {
      this.port = null;
      console.log("[PiAgent Content] Disconnected from background");
    });

    console.log("[PiAgent Content] Initialized on", window.location.href);
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case "get_context":
        this.sendContext(msg.requestId);
        break;
      case "highlight_element":
        this.highlightElement(msg.payload?.selector);
        break;
      case "scroll_to":
        this.scrollToElement(msg.payload?.selector);
        break;
    }
  }

  private sendContext(requestId: string): void {
    const context = this.extractContext();
    this.port?.postMessage({
      type: "context_response",
      payload: context,
      requestId,
    });
  }

  private extractContext(): PageContext {
    // Get selection
    const selection = window.getSelection()?.toString() ?? "";

    // Get viewport
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };

    // Get meta tags
    const meta: Record<string, string> = {};
    document.querySelectorAll("meta").forEach((el) => {
      const name = el.getAttribute("name") ?? el.getAttribute("property") ?? "";
      const content = el.getAttribute("content") ?? "";
      if (name && content) meta[name] = content;
    });

    // Simplified DOM snapshot (interactive elements + text content)
    const domSnapshot = this.createDOMSnapshot();

    return {
      url: window.location.href,
      title: document.title,
      selection,
      viewport,
      domSnapshot,
      meta,
    };
  }

  private createDOMSnapshot(): string {
    // Focus on interactive elements and visible text
    const interactiveSelectors = [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "[role=button]",
      "[role=link]",
      "[onclick]",
      "[data-testid]",
    ];

    const elements = document.querySelectorAll(interactiveSelectors.join(", "));
    const parts: string[] = [];

    // Add visible text content (truncated)
    const bodyText = document.body?.innerText?.slice(0, 5000) ?? "";
    parts.push(`[PAGE TEXT]\n${bodyText}\n`);

    parts.push("[INTERACTIVE ELEMENTS]");
    elements.forEach((el, i) => {
      if (i > 50) return; // Limit
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className?.split(" ").filter(Boolean).map((c) => `.${c}`).join("") ?? "";
      const text = el.textContent?.trim().slice(0, 100) ?? "";
      const href = (el as HTMLAnchorElement).href ?? "";
      const type = (el as HTMLInputElement).type ?? "";
      const role = el.getAttribute("role") ?? "";
      const testId = el.getAttribute("data-testid") ?? "";

      let desc = `${tag}${id}${cls}`;
      if (href) desc += ` @ ${href}`;
      if (type) desc += ` [${type}]`;
      if (role) desc += ` [role=${role}]`;
      if (testId) desc += ` [testid=${testId}]`;
      if (text) desc += ` "${text}"`;

      parts.push(`  ${desc}`);
    });

    return parts.join("\n");
  }

  private highlightElement(selector?: string): void {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;

    // Remove existing highlights
    document.querySelectorAll(".pi-agent-highlight").forEach((e) => e.classList.remove("pi-agent-highlight"));

    // Add highlight style
    const style = document.createElement("style");
    style.textContent = `
      .pi-agent-highlight {
        outline: 3px solid #00d4aa !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(0, 212, 170, 0.3) !important;
        transition: outline 0.2s, box-shadow 0.2s !important;
      }
    `;
    document.head.appendChild(style);

    el.classList.add("pi-agent-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Remove after 5 seconds
    setTimeout(() => {
      el.classList.remove("pi-agent-highlight");
      style.remove();
    }, 5000);
  }

  private scrollToElement(selector?: string): void {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new PiAgentContentScript());
} else {
  new PiAgentContentScript();
}