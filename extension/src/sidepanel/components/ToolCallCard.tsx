import React, { useState } from "react";
import type { ToolCall } from "../types";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

/**
 * One tool line per call. The whole row is clickable (with a visible
 * hover effect) to expand args/result. When a call completes, a short
 * result preview appears inline so you usually don't need to expand.
 */
export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const done = toolCall.status !== "running";
  const failed = toolCall.status === "failed";

  const marker = failed ? "✗" : done ? "✓" : "◇";
  const markerColor = failed ? t.red : done ? t.greenDim : t.green;
  const markerTitle = failed
    ? "This tool call failed — click to see the error"
    : done
      ? "Completed — click to see full details"
      : "Running right now…";

  return (
    <div style={{ borderLeft: `1px solid ${t.border}`, paddingLeft: 8 }}>
      <div
        className="pi-tool-line"
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
        title={`Tool call: ${toolCall.name}. Click the line to ${expanded ? "hide" : "show"} arguments and output.`}
      >
        <span style={{ ...styles.marker, color: markerColor }} title={markerTitle}>
          {marker}
        </span>
        <span style={{ color: t.blue, fontWeight: 600, flexShrink: 0 }}>{toolCall.name}</span>
        <span style={{ color: t.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>
          {previewArgs(toolCall.args)}
        </span>
        {!expanded && done && toolCall.result !== undefined && (
          <span style={{ color: failed ? t.red : t.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            → {previewResult(toolCall.result)}
          </span>
        )}
        <span style={{ color: t.dim, fontSize: font.sizeSmall, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "4px 0 6px" }}>
          <div style={{ color: t.faint, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 2 }}>
            arguments
          </div>
          <pre style={{ ...styles.pre, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.white }}>
            {safeJson(toolCall.args)}
          </pre>
          {toolCall.result !== undefined && (
            <>
              <div style={{ color: t.faint, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 2 }}>
                {failed ? "error" : "output"}
              </div>
              <pre style={{ ...styles.pre, background: t.bgPanel, border: `1px solid ${t.border}`, color: failed ? t.red : t.white }}>
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
  return `${key}=${text.slice(0, 50)}${text.length > 50 ? "…" : ""}`;
}

function previewResult(result: unknown): string {
  const text =
    typeof result === "string" ? result : result === undefined ? "" : safeJson(result);
  const firstLine = text.split("\n").map(l => l.trim()).filter(Boolean)[0] ?? "(empty)";
  return `${firstLine.slice(0, 60)}${firstLine.length > 60 ? "…" : ""}`;
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
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    padding: "2px 4px",
    fontSize: font.sizeSmall,
    borderRadius: 2,
  },
  marker: { width: 12, fontFamily: font.mono, flexShrink: 0 },
  pre: {
    margin: 0,
    padding: 6,
    fontSize: font.sizeTiny,
    overflow: "auto",
    maxHeight: 180,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};