import React, { useState } from "react";
import type { ToolCall } from "../types";
import { colors, font } from "../theme";

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const done = toolCall.status !== "running";
  const failed = toolCall.status === "failed";

  const marker = failed ? "✗" : done ? "✓" : "·";
  const markerColor = failed ? colors.red : done ? colors.greenDim : colors.green;

  return (
    <div style={styles.card}>
      <div style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={{ ...styles.marker, color: markerColor }}>{marker}</span>
        <span style={styles.toolName}>{toolCall.name}</span>
        <span style={styles.argsPreview}>
          {previewArgs(toolCall.args)}
        </span>
        <span style={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={styles.body}>
          <div style={styles.sectionLabel}>args</div>
          <pre style={styles.pre}>{safeJson(toolCall.args)}</pre>
          {toolCall.result !== undefined && (
            <>
              <div style={styles.sectionLabel}>{failed ? "error" : "result"}</div>
              <pre style={{ ...styles.pre, color: failed ? colors.red : colors.green }}>
                {formatResult(toolCall.result, failed)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function previewArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args ?? {});
  if (entries.length === 0) return "";
  const [key, value] = entries[0];
  const text = typeof value === "string" ? value : safeJson(value);
  return `${key}=${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatResult(result: unknown, failed: boolean): string {
  if (result === undefined) return "(no result)";
  if (typeof result === "string") return failed ? result : truncate(result, 2000);
  return truncate(safeJson(result), 2000);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… [truncated]` : text;
}

const styles: Record<string, React.CSSProperties> = {
  card: { borderLeft: `1px solid ${colors.border}`, paddingLeft: 8 },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    cursor: "pointer",
    padding: "1px 0",
    fontSize: font.sizeSmall,
  },
  marker: { width: 12, fontFamily: font.mono },
  toolName: { color: colors.blue, fontWeight: 600 },
  argsPreview: { color: colors.dim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chevron: { color: colors.faint, fontSize: font.sizeTiny },
  body: { padding: "4px 0 6px" },
  sectionLabel: { color: colors.faint, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 2 },
  pre: {
    margin: 0,
    padding: 6,
    background: colors.bgPanel,
    border: `1px solid ${colors.border}`,
    color: colors.white,
    fontSize: font.sizeTiny,
    overflow: "auto",
    maxHeight: 180,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};