import React from "react";
import type { Message } from "../types";
import { ToolCallCard } from "./ToolCallCard";

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>π</div>
        <div style={styles.emptyText}>Pi Browser Agent ready</div>
        <div style={styles.emptyHint}>
          Ask me to analyze this page, write code, or automate tasks.
          Toggle 🔗 to include live page context with each message.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "system") {
    return <div style={styles.systemMessage}>{message.content}</div>;
  }

  const isUser = message.role === "user";
  const hasContent = Boolean(message.content || message.thinking || message.toolCalls?.length);

  if (!hasContent) return null;

  return (
    <div style={{ ...styles.messageWrapper, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          ...styles.bubble,
          background: isUser ? "#1f6feb" : "#161b22",
          borderColor: isUser ? "transparent" : "#30363d",
        }}
      >
        {message.thinking && (
          <details style={styles.thinking}>
            <summary style={styles.thinkingSummary}>thinking</summary>
            <div style={styles.thinkingText}>{message.thinking}</div>
          </details>
        )}
        {message.content && <div style={styles.messageContent}>{message.content}</div>}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={styles.toolCalls}>
            {message.toolCalls.map(tc => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", color: "#8b949e", gap: "8px", padding: "40px 20px", textAlign: "center" },
  emptyIcon: { fontSize: "48px", color: "#58a6ff", fontWeight: 700 },
  emptyText: { fontSize: "15px", fontWeight: 600, color: "#e6edf3" },
  emptyHint: { fontSize: "12px", color: "#8b949e", lineHeight: 1.5 },
  messageWrapper: { display: "flex", width: "100%" },
  bubble: {
    maxWidth: "88%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid",
  },
  messageContent: { fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#e6edf3" },
  thinking: { marginBottom: "6px" },
  thinkingSummary: { fontSize: "11px", color: "#8b949e", cursor: "pointer" },
  thinkingText: { fontSize: "12px", color: "#8b949e", whiteSpace: "pre-wrap", marginTop: "4px", borderLeft: "2px solid #30363d", paddingLeft: "8px" },
  toolCalls: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" },
  systemMessage: { fontSize: "12px", color: "#8b949e", textAlign: "center", padding: "8px", fontStyle: "italic", whiteSpace: "pre-wrap" },
};