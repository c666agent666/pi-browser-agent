import React from "react";
import { useTheme } from "../ThemeContext";
import { font } from "../themes";

/**
 * Panel close button — deliberately high-contrast so it's easy to spot:
 * bright glyph on a bordered chip, brightens further on hover.
 */
export function CloseButton({
  onClick,
  title,
}: {
  onClick: () => void;
  title?: string;
}) {
  const t = useTheme();
  return (
    <button
      onClick={onClick}
      className="pi-btn"
      title={title ?? "Close this panel"}
      style={{
        background: t.bgPanel,
        border: `1px solid ${t.borderBright}`,
        color: t.white,
        cursor: "pointer",
        fontFamily: font.mono,
        fontSize: font.sizeSmall,
        fontWeight: 700,
        padding: "2px 8px",
        lineHeight: 1.3,
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      ✕
    </button>
  );
}