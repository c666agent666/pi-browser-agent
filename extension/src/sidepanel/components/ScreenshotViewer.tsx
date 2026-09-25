import React, { useState } from "react";
import { Screenshot } from "../types";

interface ScreenshotViewerProps {
  screenshot: Screenshot;
  onClose: () => void;
  onVision: () => Promise<void>;
  visionPrompt: string;
  setVisionPrompt: (v: string) => void;
  visionResult: string | null;
}

export function ScreenshotViewer({
  screenshot,
  onClose,
  onVision,
  visionPrompt,
  setVisionPrompt,
  visionResult,
}: ScreenshotViewerProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>📸 Screenshot</span>
        <div style={styles.headerRight}>
          <span style={styles.url}>{screenshot.url}</span>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>
      </div>
      <div style={styles.content}>
        <div style={styles.imageWrapper}>
          {!imageError ? (
            <img
              src={screenshot.dataUrl}
              alt="Page screenshot"
              style={styles.image}
              onError={() => setImageError(true)}
            />
          ) : (
            <div style={styles.imageError}>Failed to load screenshot</div>
          )}
        </div>

        <div style={styles.visionSection}>
          <div style={styles.visionHeader}>
            <span style={styles.visionTitle}>🔍 Vision Analysis</span>
          </div>
          <div style={styles.visionInput}>
            <textarea
              value={visionPrompt}
              onChange={(e) => setVisionPrompt(e.target.value)}
              placeholder="Describe what you want the vision model to analyze (e.g., 'Find all buttons', 'Extract the table data', 'Check for errors')"
              style={styles.visionTextarea}
              rows={3}
            />
            <button onClick={onVision} disabled={!visionPrompt.trim()} style={styles.visionBtn}>
              Analyze
            </button>
          </div>
          {visionResult && (
            <div style={styles.visionResult}>
              <div style={styles.visionResultLabel}>Result</div>
              <pre style={styles.visionResultText}>{visionResult}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    borderBottom: "1px solid #30363d",
    background: "#161b22",
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  title: { fontSize: "13px", fontWeight: 600, color: "#e6edf3" },
  url: { fontSize: "11px", color: "#8b949e", fontFamily: "monospace", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  closeBtn: { background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "16px", padding: "0 4px", lineHeight: 1 },
  content: { padding: "12px", overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" },
  imageWrapper: { borderRadius: "8px", overflow: "hidden", border: "1px solid #30363d", background: "#0d1117" },
  image: { width: "100%", height: "auto", maxHeight: "50vh", display: "block" },
  imageError: { padding: "20px", textAlign: "center", color: "#8b949e" },
  visionSection: { display: "flex", flexDirection: "column", gap: "8px" },
  visionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  visionTitle: { fontSize: "13px", fontWeight: 600, color: "#e6edf3" },
  visionInput: { display: "flex", flexDirection: "column", gap: "8px" },
  visionTextarea: {
    padding: "10px",
    border: "1px solid #30363d",
    borderRadius: "6px",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: "12px",
    fontFamily: "inherit",
    resize: "vertical",
    minHeight: "70px",
    outline: "none",
  },
  visionBtn: {
    alignSelf: "flex-start",
    padding: "8px 16px",
    background: "#1f6feb",
    border: "none",
    borderRadius: "6px",
    color: "white",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  visionResult: { marginTop: "8px", padding: "10px", background: "#0d1117", border: "1px solid #21262d", borderRadius: "6px" },
  visionResultLabel: { fontSize: "10px", textTransform: "uppercase", color: "#8b949e", marginBottom: "4px" },
  visionResultText: { fontSize: "12px", color: "#e6edf3", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 },
};