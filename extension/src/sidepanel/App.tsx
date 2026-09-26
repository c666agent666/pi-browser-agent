import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
import { PageContextPanel } from "./components/PageContextPanel";
import { ScreenshotViewer } from "./components/ScreenshotViewer";
import { SettingsPanel } from "./components/SettingsPanel";
import { usePiAgent } from "./hooks/usePiAgent";
import { usePageContext } from "./hooks/usePageContext";
import { useSettings, useTheme } from "./ThemeContext";
import { font, scanlinesCss } from "./themes";
import type { Screenshot } from "./types";

const HEALTH_URL = "http://127.0.0.1:3848";

export function App() {
  const t = useTheme();
  const { settings } = useSettings();

  const {
    connected,
    sessionId,
    streaming,
    messages,
    serverSettings,
    modelsList,
    sendMessage,
    abort,
    newSession,
    requestScreenshot,
    requestVision,
    setInteractionModel,
    setVisionModel,
    refreshModels,
  } = usePiAgent();

  const { context, refresh, captureScreenshot } = usePageContext();

  const [showContext, setShowContext] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [visionPrompt, setVisionPrompt] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [cdpOnline, setCdpOnline] = useState<boolean | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSend = useCallback(
    async (text: string) => {
      const ctx = includeContext ? await refresh() : null;
      await sendMessage(text, ctx ?? undefined);
    },
    [includeContext, refresh, sendMessage],
  );

  const handleScreenshot = useCallback(async () => {
    if (!settings.screenshotEnabled) return;
    const shot = await captureScreenshot();
    if (shot) {
      setScreenshot(shot);
      setVisionResult(null);
    }
  }, [captureScreenshot, settings.screenshotEnabled]);

  const handleVision = useCallback(async () => {
    if (!screenshot || !visionPrompt.trim()) return;
    try {
      const analysis = await requestVision(screenshot.dataUrl, visionPrompt);
      setVisionResult(analysis);
    } catch (error) {
      setVisionResult(`[error] ${String(error)}`);
    }
  }, [requestVision, screenshot, visionPrompt]);

  // New chat needs a second click within 3 seconds — it wipes the
  // conversation, so it must be visibly confirmed.
  const handleNew = useCallback(() => {
    if (!confirmNew) {
      setConfirmNew(true);
      confirmTimerRef.current = setTimeout(() => setConfirmNew(false), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    setConfirmNew(false);
    void newSession();
  }, [confirmNew, newSession]);

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
      if (detail && settings.screenshotEnabled) setScreenshot(detail);
    };
    window.addEventListener("pi-agent-screenshot", listener);
    return () => window.removeEventListener("pi-agent-screenshot", listener);
  }, [settings.screenshotEnabled]);

  const activeModel =
    serverSettings?.activeModel ?? serverSettings?.interactionModel ?? null;
  const activeModelShort = activeModel
    ? activeModel.modelId.split("/").pop()!.slice(0, 18)
    : "default";

  return (
    <div className="pi-crt" style={{ ...styles.container, background: t.bg, color: t.white, fontFamily: font.mono, fontSize: font.size }}>
      <style>{scanlinesCss(t)}</style>

      {/* ── status bar ─────────────────────────────────────────── */}
      <div style={{ ...styles.statusBar, background: t.bgPanel, borderBottom: `1px solid ${t.borderBright}` }}>
        <span
          style={{ ...styles.statusSeg, color: t.green, fontWeight: 700 }}
          title="pi-browser-agent — a local AI agent running on this computer via the pi (omp) CLI. It can read and control this browser. Everything stays on your machine."
        >
          π agent
        </span>
        <span
          style={{ ...styles.statusSeg, color: t.dim }}
          title={`Session id: ${sessionId ?? "(connecting)"} — this conversation. It survives closing the panel and even server restarts. [new chat] starts a fresh one.`}
        >
          {sessionId ? `s=${sessionId.replace(/^sess_/, "").slice(0, 8)}` : "s=…"}
        </span>
        <span
          style={{ ...styles.statusSeg, color: connected ? t.green : t.red }}
          title="WS = WebSocket connection to the local agent server (port 3848). OK means the agent is reachable. If DOWN, start it with the desktop launcher."
        >
          {connected ? "WS:OK" : "WS:DOWN"}
        </span>
        <span
          style={{ ...styles.statusSeg, color: cdpOnline ? t.green : t.faint, cursor: "help" }}
          title={
            cdpOnline
              ? "CDP:ONLINE — the agent can control this browser: open pages, click, type. Your logins work because it drives your real browser."
              : "CDP:OFF — the browser wasn't launched with the debug port, so the agent can't control it. Close the browser and use the 'Launch Pi Agent' desktop icon. Chat still works."
          }
        >
          {cdpOnline === null ? "CDP:…" : cdpOnline ? "CDP:ONLINE" : "CDP:OFF"}
        </span>
        <span
          style={{ ...styles.statusSeg, color: t.blue }}
          title={`Interaction model (the agent's brain): ${activeModel?.provider ? `${activeModel.provider}/` : ""}${activeModel?.modelId ?? "pi default"} — change it in [settings].`}
        >
          m={activeModelShort}
        </span>
        <span
          style={{ ...styles.statusRight, color: settings.screenshotEnabled ? t.green : t.faint, cursor: "help" }}
          title={
            settings.screenshotEnabled
              ? `Screenshots ON — vision model: ${serverSettings?.visionModel ?? "(default)"}. Toggle in [settings].`
              : "Screenshots OFF — the agent reads the page's HTML/CSS/JS directly. Turn on in [settings] if you want image capture + vision."
          }
        >
          cam:{settings.screenshotEnabled ? "on" : "off"}
          {settings.screenshotEnabled ? ` (${(serverSettings?.visionModel ?? "").split(":")[0].slice(0, 10)})` : ""}
        </span>
      </div>

      {/* ── toolbar ────────────────────────────────────────────── */}
      <div style={{ ...styles.toolbar, background: t.bgPanel, borderBottom: `1px solid ${t.border}` }}>
        <TermButton
          onClick={() => setShowContext(v => !v)}
          active={showContext}
          label="page info"
          title="Show what the agent can see of this page: URL, title, your selected text, viewport, and a simplified DOM outline. Read-only — nothing is changed."
        />
        {settings.screenshotEnabled && (
          <TermButton
            onClick={handleScreenshot}
            label="screenshot"
            title="Capture this page right now and open the vision panel — ask a vision model anything about the screenshot (e.g. 'find all form fields')."
          />
        )}
        <TermButton
          onClick={() => setIncludeContext(v => !v)}
          active={includeContext}
          label="auto-attach"
          title="ON: every message you send automatically includes this page's info (URL, title, selection, DOM outline) so the agent knows where you are. OFF: plain messages only."
        />
        <TermButton
          onClick={handleNew}
          active={confirmNew}
          label={confirmNew ? "sure?" : "new chat"}
          danger={confirmNew}
          title={confirmNew ? "Click again to erase this conversation and start fresh." : "Start a NEW conversation. The current one is erased (click twice to confirm)."}
        />
        <TermButton
          onClick={() => setShowSettings(true)}
          label="settings"
          title="Change models (interaction + vision), turn screenshots off/on, and pick colors & themes."
        />
      </div>

      {showContext && <PageContextPanel context={context} onClose={() => setShowContext(false)} />}

      {screenshot && settings.screenshotEnabled && (
        <ScreenshotViewer
          screenshot={screenshot}
          onClose={() => setScreenshot(null)}
          onVision={handleVision}
          visionPrompt={visionPrompt}
          setVisionPrompt={setVisionPrompt}
          visionResult={visionResult}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          serverSettings={serverSettings}
          modelsList={modelsList}
          setInteractionModel={setInteractionModel}
          setVisionModel={setVisionModel}
          refreshModels={refreshModels}
        />
      )}

      {/* ── terminal log ───────────────────────────────────────── */}
      <div style={styles.log}>
        <MessageList messages={messages} streaming={streaming} />
        {streaming && (
          <div style={styles.streamingLine}>
            <span className="pi-cursor">▊</span>
            <span style={{ color: t.dim, marginLeft: 6 }}>agent working — you can abort</span>
            <button
              style={{ ...styles.abortButton, borderColor: t.red, color: t.red }}
              onClick={() => abort()}
              disabled={!connected}
              title="Stop the agent immediately (what it already did is kept)"
            >
              ABORT
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
  title,
  danger,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  title: string;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      className="pi-btn"
      style={{
        ...styles.termButton,
        color: danger ? t.red : active ? t.green : t.dim,
        borderColor: danger ? t.red : active ? t.greenDim : t.border,
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
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 10px",
    fontSize: font.sizeSmall,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  statusSeg: { cursor: "help" },
  statusRight: { marginLeft: "auto", fontSize: font.sizeTiny, cursor: "help" },
  toolbar: { display: "flex", gap: 6, padding: "6px 10px", flexWrap: "wrap" },
  termButton: {
    background: "transparent",
    border: "1px solid",
    padding: "2px 6px",
    fontSize: font.sizeTiny,
    fontFamily: font.mono,
  },
  log: { flex: 1, overflow: "auto", padding: "10px 12px" },
  streamingLine: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  abortButton: {
    marginLeft: "auto",
    background: "transparent",
    border: "1px solid",
    fontSize: font.sizeTiny,
    padding: "2px 8px",
    cursor: "pointer",
    fontFamily: font.mono,
  },
};