import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
import { PageContextPanel } from "./components/PageContextPanel";
import { ScreenshotViewer } from "./components/ScreenshotViewer";
import { usePiAgent } from "./hooks/usePiAgent";
import { usePageContext } from "./hooks/usePageContext";
import { colors, font, scanlinesCss } from "./theme";
import type { Screenshot } from "./types";

const HEALTH_URL = "http://127.0.0.1:3848";

export function App() {
  const {
    connected,
    sessionId,
    streaming,
    messages,
    sendMessage,
    abort,
    newSession,
    requestVision,
  } = usePiAgent();

  const { context, refresh, captureScreenshot } = usePageContext();

  const [showContext, setShowContext] = useState(false);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [visionPrompt, setVisionPrompt] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [cdpOnline, setCdpOnline] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(
    async (text: string) => {
      const ctx = includeContext ? await refresh() : null;
      await sendMessage(text, ctx ?? undefined);
    },
    [includeContext, refresh, sendMessage],
  );

  const handleScreenshot = useCallback(async () => {
    const shot = await captureScreenshot();
    if (shot) {
      setScreenshot(shot);
      setVisionResult(null);
    }
  }, [captureScreenshot]);

  const handleVision = useCallback(async () => {
    if (!screenshot || !visionPrompt.trim()) return;
    try {
      const analysis = await requestVision(screenshot.dataUrl, visionPrompt);
      setVisionResult(analysis);
    } catch (error) {
      setVisionResult(`[error] ${String(error)}`);
    }
  }, [requestVision, screenshot, visionPrompt]);

  // Auto-scroll the terminal log.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // CDP control indicator: can the agent drive this browser right now?
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch(`${HEALTH_URL}/api/cdp/targets`);
        const data = (await response.json()) as { ok: boolean };
        if (!cancelled) setCdpOnline(data.ok);
      } catch {
        if (!cancelled) setCdpOnline(false);
      }
    };
    void check();
    const interval = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Server-side screenshot events (agent-initiated captures).
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Screenshot>).detail;
      if (detail) setScreenshot(detail);
    };
    window.addEventListener("pi-agent-screenshot", listener);
    return () => window.removeEventListener("pi-agent-screenshot", listener);
  }, []);

  return (
    <div className="pi-crt" style={styles.container}>
      <style>{scanlinesCss}</style>

      {/* ── status bar ─────────────────────────────────────────── */}
      <div style={styles.statusBar}>
        <span style={{ ...styles.statusSeg, color: colors.green, fontWeight: 700 }}>
          π pi-agent
        </span>
        <span style={styles.statusSeg}>{sessionId ? sessionId.slice(0, 14) : "…"}</span>
        <span style={{ ...styles.statusSeg, color: connected ? colors.green : colors.red }}>
          {connected ? "WS:OK" : "WS:DOWN"}
        </span>
        <span
          style={{
            ...styles.statusSeg,
            color: cdpOnline ? colors.green : colors.faint,
            cursor: "help",
          }}
          title={
            cdpOnline
              ? "Agent can control this browser (CDP debug port detected). Type a task and it will click/type/navigate."
              : "Relaunch the browser with --remote-debugging-port=9222 to let the agent control it (context, screenshots and vision still work without it)."
          }
        >
          {cdpOnline === null ? "CDP:…" : cdpOnline ? "CDP:ONLINE" : "CDP:OFF"}
        </span>
        <span style={{ ...styles.statusRight, color: includeContext ? colors.green : colors.faint }}>
          ctx
        </span>
      </div>

      {/* ── toolbar ────────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        <TermButton onClick={() => setShowContext(v => !v)} active={showContext} label="context" />
        <TermButton onClick={handleScreenshot} label="capture" />
        <TermButton onClick={() => setIncludeContext(v => !v)} active={includeContext} label="page-ctx" />
        <TermButton onClick={() => newSession()} label="new" />
      </div>

      {showContext && <PageContextPanel context={context} onClose={() => setShowContext(false)} />}

      {screenshot && (
        <ScreenshotViewer
          screenshot={screenshot}
          onClose={() => setScreenshot(null)}
          onVision={handleVision}
          visionPrompt={visionPrompt}
          setVisionPrompt={setVisionPrompt}
          visionResult={visionResult}
        />
      )}

      {/* ── terminal log ───────────────────────────────────────── */}
      <div style={styles.log}>
        <MessageList messages={messages} />
        {streaming && (
          <div style={styles.streamingLine}>
            <span style={{ color: colors.greenDim }}>▊</span>
            <span style={{ color: colors.dim, marginLeft: 6 }}>working</span>
            <button style={styles.abortButton} onClick={() => abort()} disabled={!connected}>
              ^ABORT
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <InputBar onSend={handleSend} disabled={!connected} />
    </div>
  );
}

function TermButton({
  onClick,
  active,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.termButton,
        color: active ? colors.green : colors.dim,
        borderColor: active ? colors.greenDim : colors.border,
      }}
    >
      [{label}]
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: colors.bg,
    fontFamily: font.mono,
    fontSize: font.size,
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 10px",
    background: colors.bgPanel,
    borderBottom: `1px solid ${colors.borderBright}`,
    fontSize: font.sizeSmall,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  statusSeg: { color: colors.dim },
  statusRight: { marginLeft: "auto", fontSize: font.sizeTiny },
  toolbar: {
    display: "flex",
    gap: 6,
    padding: "6px 10px",
    borderBottom: `1px solid ${colors.border}`,
    background: colors.bgPanel,
  },
  termButton: {
    background: "transparent",
    border: `1px solid ${colors.border}`,
    padding: "2px 6px",
    fontSize: font.sizeTiny,
    cursor: "pointer",
    fontFamily: font.mono,
  },
  log: { flex: 1, overflow: "auto", padding: "10px 12px" },
  streamingLine: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  abortButton: {
    marginLeft: "auto",
    background: "transparent",
    border: `1px solid ${colors.red}`,
    color: colors.red,
    fontSize: font.sizeTiny,
    padding: "2px 8px",
    cursor: "pointer",
    fontFamily: font.mono,
  },
};