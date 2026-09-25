import React from "react";
import type { PageContextSummary } from "../types";

interface PageContextPanelProps {
  context: PageContextSummary | null;
  onClose: () => void;
}

export function PageContextPanel({ context, onClose }: PageContextPanelProps) {
  if (!context) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>📄 Page Context</span>
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          ✕
        </button>
      </div>
      <div style={styles.content}>
        <div style={styles.section}>
          <div style={styles.label}>URL</div>
          <div style={styles.value}>{context.url}</div>
        </div>
        <div style={styles.section}>
          <div style={styles.label}>Title</div>
          <div style={styles.value}>{context.title}</div>
        </div>
        {context.selection && (
          <div style={styles.section}>
            <div style={styles.label}>Selection</div>
            <pre style={styles.selection}>{context.selection}</pre>
          </div>
        )}
        {context.viewport && (
          <div style={styles.section}>
            <div style={styles.label}>Viewport</div>
            <div style={styles.value}>
              {context.viewport.width}×{context.viewport.height} @ scroll({context.viewport.scrollX}, {context.viewport.scrollY})
            </div>
          </div>
        )}
        {context.meta && (
          <div style={styles.section}>
            <div style={styles.label}>Meta Tags</div>
            {Object.entries(context.meta).map(([k, v]) => (
              <div key={k} style={styles.metaRow}>
                <span style={styles.metaKey}>{k}</span>
                <span style={styles.metaValue}>{v}</span>
              </div>
            ))}
          </div>
        )}
        {context.domSnapshot && (
          <div style={styles.section}>
            <div style={styles.label}>DOM Snapshot (truncated)</div>
            <pre style={styles.domSnapshot}>{context.domSnapshot.slice(0, 3000)}…</pre>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderBottom: "1px solid #30363d",
    background: "#161b22",
    maxHeight: "40vh",
    display: "flex",
    flexDirection: "column",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" },
  title: { fontSize: "13px", fontWeight: 600, color: "#e6edf3" },
  closeBtn: { background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "16px", padding: "0 4px", lineHeight: 1 },
  content: { padding: "0 12px 12px", overflow: "auto", flex: 1 },
  section: { marginBottom: "12px" },
  label: { fontSize: "10px", textTransform: "uppercase", color: "#8b949e", marginBottom: "4px" },
  value: { fontSize: "12px", color: "#e6edf3", wordBreak: "break-all", fontFamily: "monospace" },
  selection: { fontSize: "11px", color: "#a5d6ff", background: "#0d1117", padding: "8px", borderRadius: "4px", border: "1px solid #21262d", maxHeight: "100px", overflow: "auto" },
  metaRow: { display: "flex", gap: "8px", fontSize: "11px", padding: "2px 0" },
  metaKey: { color: "#8b949e", minWidth: "100px" },
  metaValue: { color: "#e6edf3", wordBreak: "break-all", flex: 1 },
  domSnapshot: { fontSize: "10px", color: "#8b949e", background: "#0d1117", padding: "8px", borderRadius: "4px", border: "1px solid #21262d", maxHeight: "200px", overflow: "auto", lineHeight: 1.4 },
};