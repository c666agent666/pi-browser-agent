/**
 * Terminal theme system — presets + custom color overrides.
 * Never white backgrounds. The user's requested palette is the default
 * ("nebula"): bg #020224, accent #5c035c, dimmed #025a70, zebra #190224,
 * keeping the green text they like.
 */

export interface ThemeColors {
  /** Page background. */
  bg: string;
  /** Bars, panels, elevated surfaces. */
  bgPanel: string;
  /** Alternating line background (zebra striping). */
  zebra: string;
  /** Blockquote/section borders. */
  border: string;
  borderBright: string;
  /** Accent color (highlights, selection). */
  accent: string;
  /** Primary text green. */
  green: string;
  greenDim: string;
  /** Glow derived from green. */
  greenFaint: string;
  /** Secondary text. */
  white: string;
  /** Meta text / dimmed color. */
  dim: string;
  faint: string;
  red: string;
  yellow: string;
  blue: string;
}

export const font = {
  mono:
    '"Cascadia Mono", "Cascadia Code", "JetBrains Mono", Consolas, "DejaVu Sans Mono", ui-monospace, monospace',
  size: 13,
  sizeSmall: 11,
  sizeTiny: 10,
};

/** #rrggbb (or #rgb) -> rgba(r,g,b,a). */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map(c => c + c)
          .join("")
      : clean;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type ThemeId = "nebula" | "terminal" | "matrix" | "amber" | "midnight";

export const THEME_IDS: ThemeId[] = ["nebula", "terminal", "matrix", "amber", "midnight"];

export const THEME_NAMES: Record<ThemeId, string> = {
  nebula: "nebula (your colors)",
  terminal: "terminal green",
  matrix: "matrix",
  amber: "amber console",
  midnight: "midnight ocean",
};

/** The user's requested palette — default theme. */
const nebula: ThemeColors = {
  bg: "#020224",
  bgPanel: "#070330",
  zebra: "#190224",
  border: "#160b38",
  borderBright: "#5c035c",
  accent: "#5c035c",
  green: "#4af626",
  greenDim: "#2b7a1f",
  greenFaint: withAlpha("#4af626", 0.12),
  white: "#e6ede6",
  dim: "#025a70",
  faint: "#40356b",
  red: "#ff4d6d",
  yellow: "#f5d76e",
  blue: "#7aa2ff",
};

/** The original v0.2 look. */
const terminal: ThemeColors = {
  bg: "#050805",
  bgPanel: "#0a0f0a",
  zebra: "#0e140e",
  border: "#1f331f",
  borderBright: "#2f4f2f",
  accent: "#2f4f2f",
  green: "#4af626",
  greenDim: "#2b7a1f",
  greenFaint: withAlpha("#4af626", 0.12),
  white: "#e6ede6",
  dim: "#7a8a7a",
  faint: "#4a5a4a",
  red: "#ff5555",
  yellow: "#f5d76e",
  blue: "#55aaff",
};

const matrix: ThemeColors = {
  bg: "#000000",
  bgPanel: "#020a02",
  zebra: "#061206",
  border: "#0f2f0f",
  borderBright: "#1f5f1f",
  accent: "#0f5f0f",
  green: "#00ff41",
  greenDim: "#0f9f2f",
  greenFaint: withAlpha("#00ff41", 0.15),
  white: "#d8f8d8",
  dim: "#3f7f3f",
  faint: "#1f4f1f",
  red: "#ff3333",
  yellow: "#ccff33",
  blue: "#44ffaa",
};

const amber: ThemeColors = {
  bg: "#0d0800",
  bgPanel: "#140d02",
  zebra: "#171004",
  border: "#2a1f0a",
  borderBright: "#7a4a00",
  accent: "#7a4a00",
  green: "#ffb000",
  greenDim: "#a06d00",
  greenFaint: withAlpha("#ffb000", 0.12),
  white: "#e8dcc0",
  dim: "#8a7a5a",
  faint: "#4a4030",
  red: "#ff5533",
  yellow: "#ffd75e",
  blue: "#88aaff",
};

const midnight: ThemeColors = {
  bg: "#000a14",
  bgPanel: "#03121f",
  zebra: "#04121c",
  border: "#0a2436",
  borderBright: "#025a70",
  accent: "#025a70",
  green: "#4af626",
  greenDim: "#2b7a1f",
  greenFaint: withAlpha("#4af626", 0.12),
  white: "#dce8ee",
  dim: "#3f7a8a",
  faint: "#1f3f4f",
  red: "#ff5577",
  yellow: "#f5d76e",
  blue: "#55aaff",
};

export const THEMES: Record<ThemeId, ThemeColors> = {
  nebula,
  terminal,
  matrix,
  amber,
  midnight,
};

/** Color-wheel slots the settings menu exposes for custom overrides. */
export const COLOR_SLOTS: Array<{ key: keyof ThemeColors; label: string; hint: string }> = [
  { key: "bg", label: "background", hint: "main page background" },
  { key: "bgPanel", label: "panels", hint: "bars and panels background" },
  { key: "zebra", label: "alt line", hint: "every second line's background" },
  { key: "accent", label: "accent", hint: "highlights and bright borders" },
  { key: "green", label: "text green", hint: "primary text color" },
  { key: "white", label: "text secondary", hint: "your input and secondary text" },
  { key: "dim", label: "dimmed", hint: "meta text and hints" },
  { key: "blue", label: "tools", hint: "tool names in the log" },
  { key: "red", label: "errors", hint: "failures and abort" },
  { key: "yellow", label: "warnings", hint: "system notices" },
];

/** Merge a preset with custom overrides (and recompute the glow). */
export function resolveTheme(themeId: ThemeId, custom: Partial<ThemeColors>): ThemeColors {
  const base = THEMES[themeId] ?? nebula;
  const merged: ThemeColors = { ...base, ...custom };
  merged.greenFaint = withAlpha(merged.green, 0.12);
  return merged;
}

/** CRT scanline + cursor CSS, regenerated per theme. */
export function scanlinesCss(t: ThemeColors): string {
  return `
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
    color: ${t.green};
  }
  ::selection {
    background: ${t.green};
    color: ${t.bg};
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: ${t.bg}; }
  ::-webkit-scrollbar-thumb { background: ${t.borderBright}; border-radius: 0; }
  ::-webkit-scrollbar-thumb:hover { background: ${t.accent}; }
  .pi-tool-line { cursor: pointer; transition: background 0.1s; }
  .pi-tool-line:hover { background: ${t.greenFaint}; }
  .pi-btn { transition: filter 0.1s; cursor: pointer; }
  .pi-btn:hover { filter: brightness(1.5); }
  .pi-select {
    background: ${t.bgPanel};
    color: ${t.white};
    border: 1px solid ${t.borderBright};
    font-family: ${font.mono};
    font-size: ${font.sizeSmall}px;
    padding: 3px 6px;
    outline: none;
    width: 100%;
  }
  details summary::-webkit-details-marker { display: none; }
  input[type="color"] {
    border: 1px solid ${t.borderBright};
    background: ${t.bgPanel};
    padding: 0;
    width: 34px;
    height: 22px;
    cursor: pointer;
  }
  `;
}