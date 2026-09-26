import React from "react";
import type { PageContextSummary } from "../types";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

export function PageContextPanel({
  context,
  onClose,
}: {
  context: PageContextSummary | null;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <div style={{ ...styles.panel, background: t.bgPanel, borderBottom: `1px solid ${t.borderBright}` }}>
      <div style={styles.header}>
        <span style={{ color: t.green, fontSize: font.sizeSmall }}>┌ page info</span>
        <button
          onClick={onClose}
          className="pi-btn"
          style={{ background: "transparent", border: "none", color: t.dim, cursor: "pointer", fontFamily: font.mono, fontSize: font.sizeTiny }}
        >
          [x]
        </button>
      </div>
      <div style={{ padding: "0 10px 10px", overflow: "auto" }}>
        {!context && (
          <div style={{ color: t.faint, fontSize: font.sizeSmall }}>
            no content script on this page (chrome:// etc.)
          </div>
        )}
        {context && (
          <>
            <Field label="url" value={context.url} theme={t} />
            <Field label="title" value={context.title} theme={t} />
            {context.selection?.trim() && <Field label="selection" value={context.selection} theme={t} pre />}
            {context.viewport && (
              <Field
                label="viewport"
                value={`${context.viewport.width}×${context.viewport.height} @ (${context.viewport.scrollX}, ${context.viewport.scrollY})`}
                theme={t}
              />
            )}
            {context.meta && Object.keys(context.meta).length > 0 && (
              <Field
                label="meta"
                value={Object.entries(context.meta).map(([k, v]) => `${k}: ${v}`).join("\n")}
                theme={t}
                pre
              />
            )}
            {context.domSnapshot && <Field label="dom" value={context.domSnapshot.slice(0, 2000)} theme={t} pre />}
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  theme,
  pre,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  pre?: boolean;
}) {
  const Tag = pre ? "pre" : "div";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: theme.greenDim, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <Tag
        style={
          pre
            ? {
                color: theme.dim,
                fontSize: font.sizeTiny,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: theme.bg,
                border: `1px solid ${theme.border}`,
                padding: 6,
                maxHeight: 140,
                overflow: "auto",
                margin: 0,
              }
            : { color: theme.white, fontSize: font.sizeSmall, wordBreak: "break-all" }
        }
      >
        {value}
      </Tag>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { maxHeight: "45vh", display: "flex", flexDirection: "column" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 10px",
  },
};