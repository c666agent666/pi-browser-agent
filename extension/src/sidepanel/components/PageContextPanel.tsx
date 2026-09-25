import React from "react";
import type { PageContextSummary } from "../types";
import { colors, font } from "../theme";

export function PageContextPanel({
  context,
  onClose,
}: {
  context: PageContextSummary | null;
  onClose: () => void;
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ color: colors.green }}>┌ page context</span>
        <button onClick={onClose} style={styles.close}>
          [x]
        </button>
      </div>
      <div style={styles.content}>
        {!context && <div style={styles.empty}>no content script on this page (chrome:// etc.)</div>}
        {context && (
          <>
            <Field label="url" value={context.url} />
            <Field label="title" value={context.title} />
            {context.selection?.trim() && <Field label="selection" value={context.selection} pre />}
            {context.viewport && (
              <Field
                label="viewport"
                value={`${context.viewport.width}×${context.viewport.height} @ (${context.viewport.scrollX}, ${context.viewport.scrollY})`}
              />
            )}
            {context.meta && Object.keys(context.meta).length > 0 && (
              <Field label="meta" value={Object.entries(context.meta).map(([k, v]) => `${k}: ${v}`).join("\n")} pre />
            )}
            {context.domSnapshot && (
              <Field label="dom" value={context.domSnapshot.slice(0, 2000)} pre />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  const Tag = pre ? "pre" : "div";
  return (
    <div style={styles.field}>
      <div style={styles.label}>{label}</div>
      <Tag style={pre ? styles.preValue : styles.value}>{value}</Tag>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderBottom: `1px solid ${colors.borderBright}`,
    background: colors.bgPanel,
    maxHeight: "45vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 10px",
    fontSize: font.sizeSmall,
  },
  close: {
    background: "transparent",
    border: "none",
    color: colors.dim,
    cursor: "pointer",
    fontFamily: font.mono,
    fontSize: font.sizeTiny,
  },
  content: { padding: "0 10px 10px", overflow: "auto" },
  empty: { color: colors.faint, fontSize: font.sizeSmall },
  field: { marginBottom: 8 },
  label: { color: colors.greenDim, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 2 },
  value: { color: colors.white, fontSize: font.sizeSmall, wordBreak: "break-all" },
  preValue: {
    color: colors.dim,
    fontSize: font.sizeTiny,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    padding: 6,
    maxHeight: 140,
    overflow: "auto",
    margin: 0,
  },
};