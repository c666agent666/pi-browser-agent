import React from "react";
import type { Screenshot } from "../types";
import { colors, font } from "../theme";

export function ScreenshotViewer({
  screenshot,
  onClose,
  onVision,
  visionPrompt,
  setVisionPrompt,
  visionResult,
}: {
  screenshot: Screenshot;
  onClose: () => void;
  onVision: () => Promise<void>;
  visionPrompt: string;
  setVisionPrompt: (v: string) => void;
  visionResult: string | null;
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ color: colors.green }}>┌ capture</span>
        <span style={styles.url}>{screenshot.url}</span>
        <button onClick={onClose} style={styles.close}>
          [x]
        </button>
      </div>
      <div style={styles.content}>
        <img src={screenshot.dataUrl} alt="screenshot" style={styles.image} />
        <div style={styles.visionRow}>
          <span style={{ color: colors.green }}>❯</span>
          <input
            value={visionPrompt}
            onChange={event => setVisionPrompt(event.target.value)}
            placeholder="vision prompt — e.g. find all form fields"
            style={styles.visionInput}
            onKeyDown={event => {
              if (event.key === "Enter" && visionPrompt.trim()) void onVision();
            }}
          />
          <button onClick={() => void onVision()} disabled={!visionPrompt.trim()} style={styles.visionBtn}>
            analyze
          </button>
        </div>
        {visionResult && (
          <pre style={styles.visionResult}>
            <span style={{ color: colors.greenDim }}>vision ▸</span>{"\n"}
            {visionResult}
          </pre>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderBottom: `1px solid ${colors.borderBright}`,
    background: colors.bgPanel,
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "5px 10px",
    fontSize: font.sizeSmall,
  },
  url: { color: colors.faint, fontSize: font.sizeTiny, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  close: { background: "transparent", border: "none", color: colors.dim, cursor: "pointer", fontFamily: font.mono, fontSize: font.sizeTiny },
  content: { padding: "0 10px 10px", overflow: "auto" },
  image: {
    width: "100%",
    border: `1px solid ${colors.border}`,
    display: "block",
  },
  visionRow: { display: "flex", gap: 8, marginTop: 8, alignItems: "center" },
  visionInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: colors.white,
    fontFamily: font.mono,
    fontSize: font.sizeSmall,
    caretColor: colors.green,
  },
  visionBtn: {
    background: "transparent",
    border: `1px solid ${colors.greenDim}`,
    color: colors.green,
    fontFamily: font.mono,
    fontSize: font.sizeTiny,
    padding: "2px 8px",
    cursor: "pointer",
  },
  visionResult: {
    marginTop: 8,
    padding: 8,
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    color: colors.white,
    fontSize: font.sizeSmall,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 200,
    overflow: "auto",
  },
};