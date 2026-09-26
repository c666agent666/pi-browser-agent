import React from "react";
import type { Message } from "../types";
import { ToolCallCard } from "./ToolCallCard";
import { colors, font } from "../theme";

export function MessageList({
  messages,
  streaming,
}: {
  messages: Message[];
  streaming: boolean;
}) {
  if (messages.length === 0) {
    return (
      <div style={styles.banner}>
        <div style={styles.bannerTitle}>pi-browser-agent</div>
        <div style={styles.bannerLine}>
          <span style={{ color: colors.green }}>❯</span> agent ready — type a task below
        </div>
        <div style={styles.bannerHint}>
          the agent can read and control this browser: open pages, click,
          type, fill forms. it sees your logins because it drives your
          real browser.
        </div>
        <div style={styles.bannerKeys}>toolbar:</div>
        <div style={styles.bannerKeyRow}>
          <span style={styles.key}>[page info]</span> what the agent can see on this page
        </div>
        <div style={styles.bannerKeyRow}>
          <span style={styles.key}>[screenshot]</span> capture + vision-analyze the page
        </div>
        <div style={styles.bannerKeyRow}>
          <span style={styles.key}>[auto-attach]</span> include page info with every message
        </div>
        <div style={styles.bannerKeyRow}>
          <span style={styles.key}>[new chat]</span> start over (asks to confirm)
        </div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {messages.map((msg, index) => (
        <LogLine
          key={msg.id}
          message={msg}
          live={streaming && index === messages.length - 1}
        />
      ))}
    </div>
  );
}

function LogLine({ message, live }: { message: Message; live: boolean }) {
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
      {message.thinking && <ThinkingBlock thinking={message.thinking} live={live} />}
      {message.content && (
        <div style={styles.assistantText}>
          {message.content}
          {live && <span className="pi-cursor">▊</span>}
        </div>
      )}
      {message.toolCalls?.map(tc => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

/**
 * One collapsible thinking line per turn. The summary shows a live
 * preview of the current thought (last line, streaming cursor), so you
 * can watch what it's thinking without hundreds of lines. Click to
 * expand the full reasoning.
 */
function ThinkingBlock({ thinking, live }: { thinking: string; live: boolean }) {
  const preview = lastNonEmptyLine(thinking).slice(-80);
  return (
    <details style={styles.thinking}>
      <summary style={styles.thinkingSummary} title="The model's private reasoning before it answers. Click to read all of it.">
        <span style={{ color: live ? colors.green : colors.greenDim }}>
          {live ? "◆ thinking" : "◇ thinking"}
        </span>
        <span style={styles.thinkingPreview}>
          {live && <span className="pi-cursor" style={{ fontSize: font.sizeSmall }}>▊ </span>}
          {preview}
        </span>
        <span style={styles.thinkingMeta}>{formatChars(thinking.length)}</span>
      </summary>
      <div style={styles.thinkingText}>{thinking}</div>
    </details>
  );
}

function lastNonEmptyLine(text: string): string {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

function formatChars(count: number): string {
  return count > 999 ? `${(count / 1000).toFixed(1)}k chars` : `${count} chars`;
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: "flex", flexDirection: "column", gap: 10 },
  banner: { padding: "16px 4px", color: colors.dim, lineHeight: 1.7 },
  bannerTitle: {
    color: colors.green,
    fontWeight: 700,
    marginBottom: 8,
    textShadow: `0 0 6px ${colors.greenFaint}`,
  },
  bannerLine: { color: colors.white, marginBottom: 8 },
  bannerHint: { color: colors.dim, marginBottom: 12 },
  bannerKeys: { color: colors.faint, textTransform: "uppercase", fontSize: font.sizeTiny, marginBottom: 4 },
  bannerKeyRow: { color: colors.dim, fontSize: font.sizeSmall },
  key: { color: colors.green },
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
  thinkingSummary: {
    color: colors.dim,
    cursor: "pointer",
    listStyle: "none",
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: font.sizeSmall,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  thinkingPreview: { color: colors.dim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" },
  thinkingMeta: { color: colors.faint, fontSize: font.sizeTiny },
  thinkingText: {
    color: colors.faint,
    whiteSpace: "pre-wrap",
    marginTop: 4,
    marginBottom: 4,
    fontSize: font.sizeSmall,
    borderLeft: `1px solid ${colors.border}`,
    paddingLeft: 8,
    maxHeight: 200,
    overflow: "auto",
  },
  systemLine: { color: colors.dim, padding: "2px 0", whiteSpace: "pre-wrap" },
};