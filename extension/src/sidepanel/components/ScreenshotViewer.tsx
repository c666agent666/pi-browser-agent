import React from "react";
import type { Screenshot } from "../types";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

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
  const t = useTheme();
  return (
    <div style={{ ...styles.panel, background: t.bgPanel, borderBottom: `1px solid ${t.borderBright}` }}>
      <div style={styles.header}>
        <span style={{ color: t.green, fontSize: font.sizeSmall }}>┌ capture</span>
        <span style={{ color: t.faint, fontSize: font.sizeTiny, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {screenshot.url}
        </span>
        <button
          onClick={onClose}
          className="pi-btn"
          style={{ background: "transparent", border: "none", color: t.dim, cursor: "pointer", fontFamily: font.mono, fontSize: font.sizeTiny }}
        >
          [x]
        </button>
      </div>
      <div style={{ padding: "0 10px 10px", overflow: "auto" }}>
        <img src={screenshot.dataUrl} alt="screenshot" style={{ width: "100%", border: `1px solid ${t.border}`, display: "block" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <span style={{ color: t.green }}>❯</span>
          <input
            value={visionPrompt}
            onChange={event => setVisionPrompt(event.target.value)}
            placeholder="vision prompt — e.g. find all form fields"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: t.white,
              fontFamily: font.mono,
              fontSize: font.sizeSmall,
              caretColor: t.green,
            }}
            onKeyDown={event => {
              if (event.key === "Enter" && visionPrompt.trim()) void onVision();
            }}
          />
          <button
            onClick={() => void onVision()}
            disabled={!visionPrompt.trim()}
            className="pi-btn"
            style={{
              background: "transparent",
              border: `1px solid ${visionPrompt.trim() ? t.greenDim : t.border}`,
              color: visionPrompt.trim() ? t.green : t.faint,
              fontFamily: font.mono,
              fontSize: font.sizeTiny,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            analyze
          </button>
        </div>
        {visionResult && (
          <pre
            style={{
              marginTop: 8,
              padding: 8,
              background: t.bg,
              border: `1px solid ${t.border}`,
              color: t.white,
              fontSize: font.sizeSmall,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            <span style={{ color: t.greenDim }}>vision ▸</span>
            {"\n"}
            {visionResult}
          </pre>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { maxHeight: "70vh", display: "flex", flexDirection: "column" },
  header: { display: "flex", alignItems: "center", gap: 10, padding: "5px 10px" },
};