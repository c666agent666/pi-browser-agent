import React from "react";
import { Message, ToolCall } from "../types";
import { ToolCallCard } from "./ToolCallCard";

interface MessageListProps {
  messages: Message[];
  pendingApproval: { callId: string } | null;
}

export function MessageList({ messages, pendingApproval }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>🤖</div>
        <div style={styles.emptyText}>Pi Browser Agent ready</div>
        <div style={styles.emptyHint}>Ask me to analyze this page, write code, or automate tasks</div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} isPendingApproval={pendingApproval?.callId} />
      ))}
    </div>
  );
}

function MessageBubble({ message, isPendingApproval }: { message: Message; isPendingApproval: string | null }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";

  if (isSystem) {
    return <div style={styles.systemMessage}>{message.content}</div>;
  }

  return (
    <div style={{ ...styles.messageWrapper, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          ...styles.bubble,
          background: isUser ? "#1f6feb" : "#161b22",
          borderColor: isUser ? "transparent" : "#30363d",
          marginLeft: isUser ? "auto" : undefined,
          marginRight: isUser ? undefined : "auto",
        }}
      >
        <div style={styles.messageContent}>{formatContent(message.content)}</div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={styles.toolCalls}>
            {message.toolCalls.map((tc) => (
              <ToolCallCard
                key={tc.id}
                toolCall={tc}
                isPending={tc.id === isPendingApproval}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatContent(content: string): React.ReactNode {
  // Simple markdown-like formatting
  const lines = content.split("\n");
  return (
    <div style={styles.formattedContent}>
      {lines.map((line, i) => (
        <div key={i} style={styles.line}>
          {line.startsWith("```") ? (
            <code style={styles.codeBlock}>{line.replace("```", "")}</code>
          ) : line.startsWith("`") && line.endsWith("`") ? (
            <code style={styles.inlineCode}>{line.slice(1, -1)}</code>
          ) : (
            line
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: "flex", flexDirection: "column", gap: "12px", flex: 1, minHeight: 0 },
  empty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8b949e", gap: "8px", padding: "20px", textAlign: "center" },
  emptyIcon: { fontSize: "48px", opacity: 0.5 },
  emptyText: { fontSize: "16px", fontWeight: 500, color: "#e6edf3" },
  emptyHint: { fontSize: "12px", color: "#8b949e" },
  messageWrapper: { display: "flex", width: "100%" },
  bubble: {
    maxWidth: "85%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  messageContent: { fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  formattedContent: { display: "flex", flexDirection: "column", gap: "2px" },
  line: { fontSize: "13px", lineHeight: 1.5 },
  codeBlock: { fontFamily: "monospace", fontSize: "12px", color: "#7ee787", background: "#0d1117", padding: "2px 6px", borderRadius: "4px" },
  inlineCode: { fontFamily: "monospace", fontSize: "12px", color: "#7ee787", background: "#0d1117", padding: "1px 4px", borderRadius: "3px" },
  toolCalls: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" },
  systemMessage: { fontSize: "12px", color: "#8b949e", textAlign: "center", padding: "8px", fontStyle: "italic" },
};