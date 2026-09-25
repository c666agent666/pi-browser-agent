import React from "react";
import type { Message } from "../types";
import { ToolCallCard } from "./ToolCallCard";
import { colors, font } from "../theme";

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div style={styles.banner}>
        <div style={styles.bannerTitle}>pi-browser-agent v0.2.0</div>
        <div style={styles.bannerLine}>
          <span style={{ color: colors.green }}>❯</span> agent session ready
        </div>
        <div style={styles.bannerHint}>
          type a task — with CDP:ONLINE the agent can open pages,
          click, type and read this browser. screenshots (capture) and
          vision analysis included.
        </div>
        <div style={styles.bannerHintDim}>
          keys: [capture] screenshot · [context] page info · [page-ctx] attach context · [new] conversation
        </div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {messages.map(msg => (
        <LogLine key={msg.id} message={msg} />
      ))}
    </div>
  );
}

function LogLine({ message }: { message: Message }) {
  if (message.role === "system") {
    return (
      <div style={styles.systemLine}>
        <span style={{ color: colors.yellow }}>!</span> {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div style={styles.userLine}>
        <span style={{ ...styles.prompt, color: colors.green }}>λ</span>
        <span style={styles.userText}>{message.content}</span>
      </div>
    );
  }

  // assistant
  const empty = !message.content && !message.thinking && !message.toolCalls?.length;
  if (empty) return null;

  return (
    <div style={styles.assistantBlock}>
      {message.thinking && (
        <details style={styles.thinking}>
          <summary style={styles.thinkingSummary}>· thinking</summary>
          <div style={styles.thinkingText}>{message.thinking}</div>
        </details>
      )}
      {message.content && <div style={styles.assistantText}>{message.content}</div>}
      {message.toolCalls?.map(tc => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: "flex", flexDirection: "column", gap: 10 },
  banner: { padding: "18px 4px", color: colors.dim, lineHeight: 1.7 },
  bannerTitle: {
    color: colors.green,
    fontWeight: 700,
    marginBottom: 10,
    textShadow: `0 0 6px ${colors.greenFaint}`,
  },
  bannerLine: { color: colors.white, marginBottom: 10 },
  bannerHint: { color: colors.dim, marginBottom: 6 },
  bannerHintDim: { color: colors.faint, fontSize: font.sizeSmall },
  userLine: { display: "flex", gap: 8, alignItems: "flex-start" },
  prompt: { fontWeight: 700, textShadow: `0 0 6px ${colors.greenFaint}` },
  userText: { color: colors.white, whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 },
  assistantBlock: {
    borderLeft: `2px solid ${colors.greenDim}`,
    paddingLeft: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  assistantText: { color: colors.green, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 },
  thinking: {},
  thinkingSummary: { color: colors.faint, cursor: "pointer", listStyle: "none", fontSize: font.sizeSmall },
  thinkingText: {
    color: colors.faint,
    whiteSpace: "pre-wrap",
    marginTop: 4,
    fontSize: font.sizeSmall,
    borderLeft: `1px solid ${colors.border}`,
    paddingLeft: 8,
  },
  systemLine: { color: colors.dim, padding: "2px 0", whiteSpace: "pre-wrap" },
};