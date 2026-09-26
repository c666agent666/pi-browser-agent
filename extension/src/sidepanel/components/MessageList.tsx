import React from "react";
import type { Message } from "../types";
import { ToolCallCard } from "./ToolCallCard";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

export function MessageList({
  messages,
  streaming,
}: {
  messages: Message[];
  streaming: boolean;
}) {
  const t = useTheme();

  if (messages.length === 0) {
    return (
      <div style={{ padding: "16px 4px", lineHeight: 1.7 }}>
        <div style={{ color: t.green, fontWeight: 700, marginBottom: 8, textShadow: `0 0 6px ${t.greenFaint}` }}>
          pi-browser-agent
        </div>
        <div style={{ color: t.white, marginBottom: 8 }}>
          <span style={{ color: t.green }}>❯</span> agent ready — type a task below
        </div>
        <div style={{ color: t.dim, marginBottom: 12, fontSize: font.sizeSmall }}>
          the agent can read and control this browser: open pages, click,
          type, fill forms. it sees your logins because it drives your
          real browser.
        </div>
        <div style={{ color: t.faint, textTransform: "uppercase", fontSize: font.sizeTiny, marginBottom: 4 }}>
          toolbar:
        </div>
        <div style={{ color: t.dim, fontSize: font.sizeSmall }}>
          <span style={{ color: t.green }}>[page info]</span> what the agent can see on this page
        </div>
        <div style={{ color: t.dim, fontSize: font.sizeSmall }}>
          <span style={{ color: t.green }}>[auto-attach]</span> include page info with every message
        </div>
        <div style={{ color: t.dim, fontSize: font.sizeSmall }}>
          <span style={{ color: t.green }}>[new chat]</span> start over (asks to confirm)
        </div>
        <div style={{ color: t.dim, fontSize: font.sizeSmall }}>
          <span style={{ color: t.green }}>[settings]</span> models, screenshots on/off, colors & themes
        </div>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {messages.map((msg, index) => (
        <div
          key={msg.id}
          style={{
            padding: "4px 6px",
            borderRadius: 2,
            background: index % 2 === 1 ? t.zebra : "transparent",
          }}
        >
          <LogLine message={msg} live={streaming && index === messages.length - 1} />
        </div>
      ))}
    </div>
  );
}

function LogLine({ message, live }: { message: Message; live: boolean }) {
  const t = useTheme();

  if (message.role === "system") {
    return (
      <div style={{ color: t.dim, padding: "2px 0", whiteSpace: "pre-wrap", fontSize: font.sizeSmall }}>
        <span style={{ color: t.yellow }}>!</span> {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div style={styles.userLine}>
        <span style={{ ...styles.prompt, color: t.green, textShadow: `0 0 6px ${t.greenFaint}` }}>λ</span>
        <span style={{ color: t.white, whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 }}>
          {message.content}
        </span>
      </div>
    );
  }

  // assistant
  const empty = !message.content && !message.thinking && !message.toolCalls?.length;
  if (empty) return null;

  return (
    <div style={{ ...styles.assistantBlock, borderLeft: `2px solid ${t.greenDim}` }}>
      {message.thinking && <ThinkingBlock thinking={message.thinking} live={live} />}
      {message.content && (
        <div style={{ color: t.green, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 }}>
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
  const t = useTheme();
  const preview = lastNonEmptyLine(thinking).slice(-80);
  return (
    <details>
      <summary
        style={{
          ...styles.thinkingSummary,
          color: t.dim,
          fontSize: font.sizeSmall,
        }}
        title="The model's private reasoning before it answers. Click to read all of it."
      >
        <span style={{ color: live ? t.green : t.greenDim }}>
          {live ? "◆ thinking" : "◇ thinking"}
        </span>
        <span style={{ color: t.dim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" }}>
          {live && <span className="pi-cursor" style={{ fontSize: font.sizeSmall }}>▊ </span>}
          {preview}
        </span>
        <span style={{ color: t.faint, fontSize: font.sizeTiny }}>{formatChars(thinking.length)}</span>
      </summary>
      <div
        style={{
          color: t.faint,
          whiteSpace: "pre-wrap",
          marginTop: 4,
          marginBottom: 4,
          fontSize: font.sizeSmall,
          borderLeft: `1px solid ${t.border}`,
          paddingLeft: 8,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        {thinking}
      </div>
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
  list: { display: "flex", flexDirection: "column" },
  userLine: { display: "flex", gap: 8, alignItems: "flex-start" },
  prompt: { fontWeight: 700 },
  assistantBlock: { paddingLeft: 10, display: "flex", flexDirection: "column", gap: 6 },
  thinkingSummary: {
    cursor: "pointer",
    listStyle: "none",
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
};