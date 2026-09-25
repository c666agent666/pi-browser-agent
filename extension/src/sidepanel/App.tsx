import React, { useCallback, useEffect, useState } from "react";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
import { PageContextPanel } from "./components/PageContextPanel";
import { ScreenshotViewer } from "./components/ScreenshotViewer";
import { usePiAgent } from "./hooks/usePiAgent";
import { usePageContext } from "./hooks/usePageContext";
import type { Screenshot } from "./types";

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

  const handleSend = useCallback(
    async (text: string) => {
      // Refresh page context right before sending so it's current.
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
      setVisionResult(`⚠️ ${String(error)}`);
    }
  }, [requestVision, screenshot, visionPrompt]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Screenshot>).detail;
      if (detail) setScreenshot(detail);
    };
    window.addEventListener("pi-agent-screenshot", listener);
    return () => window.removeEventListener("pi-agent-screenshot", listener);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>π</span>
          <span style={styles.title}>Pi Agent</span>
          <span style={{ ...styles.badge, background: connected ? "#238636" : "#da3633" }}>
            {connected ? "●" : "○"} {sessionId ? sessionId.slice(0, 12) : "connecting"}
          </span>
        </div>
        <div style={styles.headerRight}>
          <IconButton
            onClick={() => setShowContext(v => !v)}
            active={showContext}
            title="Page context"
          >
            📄
          </IconButton>
          <IconButton onClick={handleScreenshot} title="Screenshot">
            📸
          </IconButton>
          <IconButton
            onClick={() => setIncludeContext(v => !v)}
            active={includeContext}
            title="Include page context in messages"
          >
            🔗
          </IconButton>
          <IconButton onClick={() => newSession()} title="New conversation">
            ✚
          </IconButton>
        </div>
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

      <div style={styles.messages}>
        <MessageList messages={messages} />
      </div>

      {streaming && (
        <div style={styles.streamingBar}>
          <span style={styles.streamingDot}>●●●</span>
          <span style={styles.streamingText}>working</span>
          <button style={styles.abortButton} onClick={() => abort()} disabled={!connected}>
            Abort
          </button>
        </div>
      )}

      <InputBar onSend={handleSend} disabled={!connected} />
    </div>
  );
}

function IconButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...styles.iconButton,
        background: active ? "rgba(88, 166, 255, 0.2)" : "transparent",
        borderColor: active ? "#58a6ff" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", background: "#0d1117" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: "1px solid #30363d",
    background: "#161b22",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "8px" },
  headerRight: { display: "flex", alignItems: "center", gap: "2px" },
  logo: { fontSize: "18px", fontWeight: 700, color: "#58a6ff" },
  title: { fontWeight: 600, fontSize: "14px", color: "#e6edf3" },
  badge: {
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    color: "white",
    fontWeight: 500,
    fontFamily: "monospace",
  },
  iconButton: {
    padding: "6px 10px",
    border: "1px solid transparent",
    borderRadius: "6px",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "15px",
  },
  messages: { flex: 1, overflow: "auto", padding: "12px" },
  streamingBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderTop: "1px solid #30363d",
    background: "#161b22",
  },
  streamingDot: { color: "#58a6ff", fontSize: "10px", letterSpacing: 2 },
  streamingText: { color: "#8b949e", fontSize: "12px", flex: 1 },
  abortButton: {
    padding: "4px 12px",
    border: "1px solid #da3633",
    background: "transparent",
    color: "#f85149",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },
};