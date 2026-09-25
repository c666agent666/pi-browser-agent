/**
 * Background service worker — relay only.
 *
 * No WebSocket here: MV3 service workers are killed after ~30s idle,
 * which would keep severing a persistent connection. The side panel
 * owns the connection; this worker just keeps the content-script port
 * registry and answers context queries.
 */

console.log("[PiAgent] Background service worker started");

// Content-script port registry, keyed by tab id.
const contentPorts = new Map<number, chrome.runtime.Port>();

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== "pi-agent-content") return;
  const tabId = port.sender?.tab?.id;
  if (tabId === undefined) return;

  contentPorts.set(tabId, port);
  port.onDisconnect.addListener(() => contentPorts.delete(tabId));
});

// Relay context requests: side panel -> content script -> side panel.
// Uses chrome.tabs.sendMessage so the panel doesn't need to know ports.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "pi_agent_get_context") return false;

  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ context: null });
        return;
      }
      // Forward to the content script in that tab. If it isn't injected
      // (chrome:// pages, web store), this throws and we answer null.
      const response = await chrome.tabs.sendMessage(tab.id, { type: "pi_agent_get_context" });
      sendResponse(response ?? { context: null });
    } catch {
      sendResponse({ context: null });
    }
  })();

  return true; // async sendResponse
});

// Keep track of content-script injections (declared statically in the
// manifest; this is a belt-and-braces re-inject for SPA navigations).
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    void chrome.scripting.executeScript({ target: { tabId }, files: ["content/index.js"] }).catch(() => {
      // chrome:// pages and friends can't be scripted — fine.
    });
  }
});