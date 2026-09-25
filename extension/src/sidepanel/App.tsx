import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageList } from "./components/MessageList";
import { InputBar } from "./components/InputBar";
import { ToolCallCard } from "./components/ToolCallCard";
import { PageContextPanel } from "./components/PageContextPanel";
import { ScreenshotViewer } from "./components/ScreenshotViewer";
import { usePiAgent } from "./hooks/usePiAgent";
import { Message, ToolCall, PageContext } from "./types";

export function App() {
  const {
    connected,
    sessionId,
    messages,
    pendingApproval,
    pageContext,
    screenshot,
    sendMessage,
    approveTool,
    denyTool,
    requestPageContext,
    requestScreenshot,
    requestVision,
    clearSession,
  } = usePiAgent();

  const [showContext, setShowContext] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  const handleApprove = async () => {
    if (pendingApproval) await approveTool(pendingApproval.callId);
  };

  const handleDeny = async () => {
    if (pendingApproval) await denyTool(pendingApproval.callId);
  };

  const handleScreenshot = async () => {
    await requestScreenshot();
    setShowScreenshot(true);
  };

  const handleVision = async () => {
    if (!screenshot || !visionPrompt.trim()) return;
    const result = await requestVision(screenshot.dataUrl, visionPrompt);
    setVisionResult(result);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>🤖</span>
          <span style={styles.title}>Pi Browser Agent</span>
          <ConnectionBadge connected={connected} />
        </div>
        <div style={styles.headerRight}>
          <IconButton onClick={() => setShowContext(!showContext)} active={showContext} title="Page Context">
            📄
          </IconButton>
          <IconButton onClick={handleScreenshot} title="Screenshot">
            📸
          </IconButton>
          <IconButton onClick={() => clearSession()} title="New Session">
            ➕
          </IconButton>
        </div>
      </div>

      {/* Page Context Panel */}
      {showContext && (
        <PageContextPanel context={pageContext} onClose={() => setShowContext(false)} />
      )}

      {/* Screenshot Viewer with Vision */}
      {showScreenshot && screenshot && (
        <ScreenshotViewer
          screenshot={screenshot}
          onClose={() => setShowScreenshot(false)}
          onVision={handleVision}
          visionPrompt={visionPrompt}
          setVisionPrompt={setVisionPrompt}
          visionResult={visionResult}
        />
      )}

      {/* Messages */}
      <div style={styles.messagesContainer}>
        <MessageList messages={messages} pendingApproval={pendingApproval} />
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Approval Banner */}
      {pendingApproval && (
        <div style={styles.approvalBanner}>
          <div style={styles.approvalInfo}>
            <span style={styles.approvalTool}>{pendingApproval.tool}</span>
            <pre style={styles.approvalArgs}>{JSON.stringify(pendingApproval.args, null, 2)}</pre>
          </div>
          <div style={styles.approvalActions}>
            <button style={styles.btnDeny} onClick={handleDeny}>Deny</button>
            <button style={styles.btnApprove} onClick={handleApprove}>Approve</button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <InputBar onSend={handleSend} disabled={!connected || !!pendingApproval} />
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{ ...styles.badge, background: connected ? "#238636" : "#da3633" }}>
      {connected ? "● Connected" : "○ Disconnected"}
    </span>
  );
}

function IconButton({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
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
  headerRight: { display: "flex", alignItems: "center", gap: "4px" },
  logo: { fontSize: "18px" },
  title: { fontWeight: 600, fontSize: "14px", color: "#e6edf3" },
  badge: { fontSize: "11px", padding: "2px 8px", borderRadius: "10px", color: "white", fontWeight: 500 },
  iconButton: {
    padding: "6px 10px",
    border: "1px solid transparent",
    borderRadius: "6px",
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 0.15s",
  },
  messagesContainer: { flex: 1, overflow: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "12px" },
  approvalBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "12px",
    background: "#3d2e00",
    border: "1px solid #8b949e",
    borderRadius: "6px",
    margin: "0 12px 12px",
    gap: "12px",
  },
  approvalInfo: { flex: 1, minWidth: 0 },
  approvalTool: { fontWeight: 600, color: "#d29922", fontSize: "13px", textTransform: "capitalize" },
  approvalArgs: { fontSize: "11px", color: "#8b949e", margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "150px", overflow: "auto" },
  approvalActions: { display: "flex", gap: "8px", flexShrink: 0 },
  btnDeny: { padding: "6px 16px", border: "1px solid #da3633", background: "transparent", color: "#f85149", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
  btnApprove: { padding: "6px 16px", border: "1px solid #238636", background: "#238636", color: "white", borderRadius: "6px", cursor: "pointer", fontSize: "12px" },
};