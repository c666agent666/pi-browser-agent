/**
 * Terminal theme — dark background, white + green monospace text,
 * console/Termux look. Shared by all side-panel components.
 */

export const colors = {
  bg: "#050805",
  bgPanel: "#0a0f0a",
  bgElevated: "#0e140e",
  border: "#1f331f",
  borderBright: "#2f4f2f",
  green: "#4af626",
  greenDim: "#2b7a1f",
  greenFaint: "rgba(74, 246, 38, 0.12)",
  white: "#e6ede6",
  dim: "#7a8a7a",
  faint: "#4a5a4a",
  red: "#ff5555",
  yellow: "#f5d76e",
  blue: "#55aaff",
};

export const font = {
  mono:
    '"Cascadia Mono", "Cascadia Code", "JetBrains Mono", Consolas, "DejaVu Sans Mono", ui-monospace, monospace',
  size: 13,
  sizeSmall: 11,
  sizeTiny: 10,
};

export const glow = (color: string, strength = 4): React.CSSProperties => ({
  textShadow: `0 0 ${strength}px ${color}`,
});

/** Standard terminal block (bordered box). */
export const block = (): React.CSSProperties => ({
  background: colors.bgPanel,
  border: `1px solid ${colors.border}`,
  borderRadius: 2,
});

/** CRT scanline overlay for the root element. */
export const scanlinesCss = `
  .pi-crt::after {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 2px,
      rgba(0, 0, 0, 0.12) 3px
    );
    z-index: 9999;
  }
  @keyframes pi-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  .pi-cursor {
    animation: pi-blink 1s step-end infinite;
    color: ${colors.green};
  }
  ::selection {
    background: ${colors.green};
    color: ${colors.bg};
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: ${colors.bg}; }
  ::-webkit-scrollbar-thumb { background: ${colors.borderBright}; border-radius: 0; }
  ::-webkit-scrollbar-thumb:hover { background: ${colors.greenDim}; }
  .pi-tool-line { cursor: pointer; transition: background 0.1s; }
  .pi-tool-line:hover { background: ${colors.greenFaint}; }
  .pi-btn { transition: filter 0.1s; cursor: pointer; }
  .pi-btn:hover { filter: brightness(1.5); }
  details summary::-webkit-details-marker { display: none; }
`;