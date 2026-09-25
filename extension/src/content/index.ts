/**
 * Content script — extracts page context (URL, title, selection,
 * viewport, interactive-element snapshot) on request. Stateless.
 */

interface ExtractedContext {
  url: string;
  title: string;
  selection: string;
  domSnapshot: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  meta: Record<string, string>;
}

function extractContext(): ExtractedContext {
  const selection = window.getSelection()?.toString() ?? "";

  const meta: Record<string, string> = {};
  document.querySelectorAll("meta").forEach(el => {
    const name = el.getAttribute("name") ?? el.getAttribute("property") ?? "";
    const content = el.getAttribute("content") ?? "";
    if (name && content && Object.keys(meta).length < 20) meta[name] = content;
  });

  return {
    url: window.location.href,
    title: document.title,
    selection,
    domSnapshot: createDomSnapshot(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    meta,
  };
}

function createDomSnapshot(): string {
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
  ].join(", ");

  const elements = document.querySelectorAll(interactiveSelectors);
  const parts: string[] = [];

  const bodyText = document.body?.innerText?.slice(0, 4000) ?? "";
  if (bodyText) parts.push(`[PAGE TEXT]\n${bodyText}\n`);

  parts.push("[INTERACTIVE ELEMENTS]");
  const limit = Math.min(elements.length, 60);
  for (let i = 0; i < limit; i++) {
    const el = elements[i];
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    const text = el.textContent?.trim().slice(0, 80) ?? "";
    const href = el instanceof HTMLAnchorElement ? el.href : "";
    const testId = el.getAttribute("data-testid") ?? "";

    let desc = `${tag}${id}${cls}`;
    if (href) desc += ` @ ${href.slice(0, 120)}`;
    if (testId) desc += ` [testid=${testId}]`;
    if (text) desc += ` "${text}"`;
    parts.push(`  ${desc}`);
  }

  return parts.join("\n");
}

// Stateless request/response — the background relay (and any extension
// page) asks, we answer synchronously.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "pi_agent_get_context") return false;
  try {
    sendResponse({ context: extractContext() });
  } catch (error) {
    sendResponse({ context: null, error: String(error) });
  }
  return true;
});

console.log("[PiAgent Content] ready on", window.location.href);