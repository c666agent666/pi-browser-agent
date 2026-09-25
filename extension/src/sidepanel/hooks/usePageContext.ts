/**
 * usePageContext — fetches page context from the active tab's content
 * script via the background relay, and captures screenshots directly
 * (chrome.tabs.captureVisibleTab works from extension pages).
 */

import { useCallback, useEffect, useState } from "react";
import type { PageContextSummary, Screenshot } from "../types";

interface GetContextResponse {
  context?: PageContextSummary;
}

interface GetContextRequest {
  type: "pi_agent_get_context";
}

export function usePageContext() {
  const [context, setContext] = useState<PageContextSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<PageContextSummary | null> => {
    setLoading(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return null;
      const response = (await chrome.tabs.sendMessage(tab.id, { type: "pi_agent_get_context" } as GetContextRequest)) as GetContextResponse;
      const ctx = response?.context ?? null;
      setContext(ctx);
      return ctx;
    } catch {
      // No content script on this page (chrome:// etc.)
      setContext(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const captureScreenshot = useCallback(async (): Promise<Screenshot | null> => {
    try {
      // Callback form (default PNG format) — the installed @types/chrome
      // overloads make the promise form awkward here.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, dataUrl => {
          const lastError = chrome.runtime.lastError;
          if (lastError) reject(new Error(lastError.message));
          else resolve(dataUrl);
        });
      });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return {
        dataUrl,
        width: 0,
        height: 0,
        url: tab?.url ?? "unknown",
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }, []);

  // Track the active tab so the context stays fresh.
  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      if (!cancelled && document.visibilityState === "visible") await refresh();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh]);

  return { context, loading, refresh, captureScreenshot };
}