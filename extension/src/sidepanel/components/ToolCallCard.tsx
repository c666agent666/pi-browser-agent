import React, { useState } from "react";
import { ToolCall } from "../types";

interface ToolCallCardProps {
  toolCall: ToolCall;
  isPending?: boolean;
}

export function ToolCallCard({ toolCall, isPending }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<ToolCall["status"], string> = {
    pending: "#d29922",
    approved: "#238636",
    denied: "#da3633",
    running: "#58a6ff",
    completed: "#238636",
    failed: "#da3633",
  };

  const statusIcons: Record<ToolCall["status"], string> = {
    pending: "⏳",
    approved: "✅",
    denied: "❌",
    running: "⚙️",
    completed: "✅",
    failed: "❌",
  };

  return (
    <div
      style={{
        ...styles.card,
        borderColor: statusColors[toolCall.status],
        opacity: isPending ? 1 : 0.9,
      }}
    >
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.icon}>{statusIcons[toolCall.status]}</span>
        <span style={{ ...styles.name, color: statusColors[toolCall.status] }}>{toolCall.name}</span>
        {toolCall.description && <span style={styles.desc}>{toolCall.description}</span>}
        <span style={styles.toggle}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={styles.body}>
          <div style={styles.argsTitle}>Arguments</div>
          <pre style={styles.args}>{JSON.stringify(toolCall.args, null, 2)}</pre>

          {toolCall.result !== undefined && (
            <>
              <div style={styles.resultTitle}>Result</div>
              <pre style={styles.result}>{formatResult(toolCall.result)}</pre>
            </>
          )}

          {toolCall.error && (
            <>
              <div style={styles.errorTitle}>Error</div>
              <pre style={styles.error}>{toolCall.error}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatResult(result: unknown): string {
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#0d1117",
    border: "1px solid",
    borderRadius: "8px",
    overflow: "hidden",
    fontSize: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    cursor: "pointer",
    background: "rgba(255,255,255,0.02)",
  },
  icon: { fontSize: "14px" },
  name: { fontWeight: 600, textTransform: "capitalize", fontSize: "12px" },
  desc: { fontSize: "11px", color: "#8b949e", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  toggle: { color: "#8b949e", fontSize: "10px" },
  body: { padding: "0 10px 10px", borderTop: "1px solid #21262d", fontSize: "11px" },
  argsTitle: { color: "#8b949e", fontSize: "10px", textTransform: "uppercase", marginTop: "8px" },
  args: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: "4px",
    padding: "8px",
    margin: "4px 0",
    overflow: "auto",
    maxHeight: "200px",
    color: "#e6edf3",
    fontFamily: "monospace",
    fontSize: "10px",
    lineHeight: 1.5,
  },
  resultTitle: { color: "#8b949e", fontSize: "10px", textTransform: "uppercase", marginTop: "8px" },
  result: {
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: "4px",
    padding: "8px",
    margin: "4px 0",
    overflow: "auto",
    maxHeight: "300px",
    color: "#7ee787",
    fontFamily: "monospace",
    fontSize: "10px",
    lineHeight: 1.5,
  },
  errorTitle: { color: "#da3633", fontSize: "10px", textTransform: "uppercase", marginTop: "8px" },
  error: {
    background: "#3d0d0d",
    border: "1px solid #da3633",
    borderRadius: "4px",
    padding: "8px",
    margin: "4px 0",
    overflow: "auto",
    maxHeight: "200px",
    color: "#f85149",
    fontFamily: "monospace",
    fontSize: "10px",
    lineHeight: 1.5,
  },
};