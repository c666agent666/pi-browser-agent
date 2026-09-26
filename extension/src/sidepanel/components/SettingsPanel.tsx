import React, { useEffect, useState } from "react";
import { useSettings, useTheme } from "../ThemeContext";
import { font, COLOR_SLOTS, THEME_IDS, THEME_NAMES, type ThemeId } from "../themes";
import type { ModelRef } from "../types";
import { CloseButton } from "./CloseButton";

/**
 * Settings menu:
 *  - models: interaction model (pi) + vision model (screenshots), both
 *    picked from LIVE lists — nothing hardcoded. A link opens ollama.com
 *    so new models can be browsed as they appear.
 *  - screenshots: optional capability toggle (agent reads HTML/CSS/JS
 *    directly, so this can stay off).
 *  - appearance: theme presets + color wheel for every color slot.
 */
export function SettingsPanel({
  onClose,
  // pi agent API (model state + setters)
  serverSettings,
  modelsList,
  setInteractionModel,
  setVisionModel,
  refreshModels,
}: {
  onClose: () => void;
  serverSettings: { visionModel: string; interactionModel?: ModelRef | null; activeModel?: ModelRef | null } | null;
  modelsList: { interaction: ModelRef[]; vision: string[] } | null;
  setInteractionModel: (provider: string, modelId: string) => Promise<void>;
  setVisionModel: (model: string) => Promise<void>;
  refreshModels: () => Promise<void>;
}) {
  const t = useTheme();
  const { settings, setScreenshotEnabled, setThemeId, setColor, resetColors } = useSettings();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  const activeModel = serverSettings?.activeModel ?? serverSettings?.interactionModel ?? null;
  const activeModelLabel = activeModel ? `${activeModel.modelId}` : "(pi default)";

  const handleNotice = (message: string) => {
    setNotice(message);
    setError(null);
    setTimeout(() => setNotice(null), 2500);
  };

  const pickInteractionModel = async (value: string) => {
    let provider: string;
    let modelId: string;
    const slash = value.indexOf("/");
    if (slash > 0) {
      provider = value.slice(0, slash);
      modelId = value.slice(slash + 1);
    } else {
      // Bare model id: find its provider in the live list, fall back to
      // "ollama" so pi surfaces a real error instead of us failing silently.
      modelId = value;
      const match = modelsList?.interaction.find(
        m => m.modelId === value || m.modelId.split("/").pop() === value || m.modelId.split(":")[0] === value,
      );
      provider = match?.provider ?? "ollama";
    }
    try {
      await setInteractionModel(provider, modelId);
      handleNotice(`interaction model → ${modelId}`);
    } catch (err) {
      setError(String(err));
    }
  };

  const pickVisionModel = async (model: string) => {
    try {
      await setVisionModel(model);
      handleNotice(`vision model → ${model}`);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.panel, background: t.bgPanel, borderColor: t.borderBright }}>
        {/* header */}
        <div style={{ ...styles.header, borderBottom: `1px solid ${t.borderBright}` }}>
          <span style={{ color: t.green, fontWeight: 700 }}>┌ settings</span>
          <CloseButton onClick={onClose} title="Close settings" />
        </div>

        <div style={styles.body}>
          {/* ── interaction model ─────────────────────────────── */}
          <Section title="interaction model" theme={t}>
            <Row theme={t}>
              <span style={{ color: t.dim }}>current:</span>
              <span style={{ color: t.white }}>{activeModelLabel}</span>
            </Row>
            <select
              className="pi-select"
              value={activeModel ? `${activeModel.provider}/${activeModel.modelId}` : ""}
              onChange={event => void pickInteractionModel(event.target.value)}
              style={{ ...styles.select, borderColor: t.borderBright }}
              title="The model the agent thinks with (any model pi supports — no vision needed)"
            >
              <option value="">{activeModel ? activeModelLabel : "pi default model"}</option>
              {modelsList?.interaction.map(m => (
                <option key={`${m.provider}/${m.modelId}`} value={`${m.provider}/${m.modelId}`}>
                  {m.name ? `${m.modelId} — ${m.name}` : m.modelId}
                </option>
              ))}
            </select>
            <button
              className="pi-btn"
              style={{ ...styles.link, color: t.green, borderColor: t.greenDim }}
              onClick={() =>
                chrome.tabs.create({ url: "https://ollama.com/search" })
              }
              title="Open ollama.com in a new tab — browse and search ALL models. New models appear there first; pick them here as soon as they exist."
            >
              [browse all models on ollama.com ↗]
            </button>
            <Hint theme={t}>
              lists come from your live account — nothing is hardcoded, so new
              models work the day they appear. type a model id below if it's not
              listed yet.
            </Hint>
            <CustomModelInput theme={t} onPick={pickInteractionModel} />
          </Section>

          {/* ── vision model + screenshots ───────────────────── */}
          <Section title="screenshots & vision" theme={t}>
            <Row theme={t}>
              <span style={{ color: t.dim }}>screenshot feature:</span>
              <button
                className="pi-btn"
                onClick={() => setScreenshotEnabled(!settings.screenshotEnabled)}
                style={{
                  ...styles.toggle,
                  color: settings.screenshotEnabled ? t.green : t.faint,
                  borderColor: settings.screenshotEnabled ? t.greenDim : t.border,
                }}
                title={
                  settings.screenshotEnabled
                    ? "ON — the [screenshot] button and vision analysis are available. Turn off to work purely from the page's HTML/CSS/JS (the agent reads the DOM directly)."
                    : "OFF — no screenshots are taken; the agent works purely from the page's HTML/CSS/JS, which is usually enough. Turn on to capture and analyze images."
                }
              >
                [{settings.screenshotEnabled ? "on" : "off"}]
              </button>
            </Row>
            <Row theme={t}>
              <span style={{ color: t.dim }}>vision model:</span>
              <span style={{ color: t.white }}>{serverSettings?.visionModel ?? "—"}</span>
            </Row>
            <select
              className="pi-select"
              value={serverSettings?.visionModel ?? ""}
              onChange={event => void pickVisionModel(event.target.value)}
              disabled={!settings.screenshotEnabled}
              style={{
                ...styles.select,
                borderColor: t.borderBright,
                opacity: settings.screenshotEnabled ? 1 : 0.4,
              }}
              title="Only models with vision capability are listed (validated live against the Ollama catalog)."
            >
              <option value="">select a vision model…</option>
              {modelsList?.vision.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {!settings.screenshotEnabled && (
              <Hint theme={t}>
                screenshots are off — the agent reads the page's html/css/js
                directly, which is usually enough. vision analysis is hidden
                until you turn screenshots back on.
              </Hint>
            )}
            {settings.screenshotEnabled && (
              <Hint theme={t}>
                the vision model only reviews screenshots — it is separate from
                the interaction model and must be vision-capable (only such
                models are listed).
              </Hint>
            )}
          </Section>

          {/* ── appearance ─────────────────────────────────────── */}
          <Section title="appearance" theme={t}>
            <div style={styles.themeRow}>
              {THEME_IDS.map(id => (
                <button
                  key={id}
                  className="pi-btn"
                  onClick={() => setThemeId(id)}
                  style={{
                    ...styles.themeButton,
                    color: settings.themeId === id ? t.green : t.dim,
                    borderColor: settings.themeId === id ? t.greenDim : t.border,
                    background:
                      settings.themeId === id ? t.greenFaint : "transparent",
                  }}
                  title={`Theme preset: ${THEME_NAMES[id]}`}
                >
                  {THEME_NAMES[id]}
                </button>
              ))}
            </div>
            <Hint theme={t}>custom colors (color wheel) — overrides the preset:</Hint>
            <div style={styles.colorGrid}>
              {COLOR_SLOTS.map(slot => (
                <label key={slot.key} style={styles.colorSlot} title={slot.hint}>
                  <input
                    type="color"
                    value={themeHex(t[slot.key])}
                    onChange={event => setColor(slot.key, event.target.value)}
                  />
                  <span style={{ color: t.dim, fontSize: font.sizeTiny }}>{slot.label}</span>
                </label>
              ))}
            </div>
            <button
              className="pi-btn"
              onClick={resetColors}
              style={{ ...styles.link, color: t.dim, borderColor: t.border }}
              title="Remove custom color overrides and go back to the preset"
            >
              [reset colors to preset]
            </button>
          </Section>

          {(notice || error) && (
            <div style={{ ...styles.notice, color: error ? t.red : t.green, borderColor: error ? t.red : t.greenDim }}>
              {error ?? notice}
            </div>
          )}
        </div>

        <div style={{ ...styles.footer, borderTop: `1px solid ${t.borderBright}`, color: t.faint }}>
          v0.3.0 · github.com/c666agent666/pi-browser-agent
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  theme,
}: {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: theme.greenDim, fontSize: font.sizeTiny, textTransform: "uppercase", marginBottom: 6 }}>
        ── {title} ──
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: font.sizeSmall }}>
      {children}
    </div>
  );
}

function Hint({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof useTheme> }) {
  return (
    <div style={{ color: theme.faint, fontSize: font.sizeTiny, lineHeight: 1.5 }}>{children}</div>
  );
}

function CustomModelInput({
  theme,
  onPick,
}: {
  theme: ReturnType<typeof useTheme>;
  onPick: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const t = theme;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder="provider/model-id"
        spellCheck={false}
        style={{
          flex: 1,
          background: t.bg,
          border: `1px solid ${t.border}`,
          color: t.white,
          fontFamily: font.mono,
          fontSize: font.sizeSmall,
          padding: "3px 6px",
          outline: "none",
          caretColor: t.green,
        }}
        title="Type any model id (e.g. ollama/new-model-name) and apply — works for models not in the list yet"
      />
      <button
        className="pi-btn"
        disabled={!value.trim()}
        onClick={() => {
          void onPick(value.trim());
          setValue("");
        }}
        style={{
          ...styles.link,
          color: value.trim() ? t.green : t.faint,
          borderColor: value.trim() ? t.greenDim : t.border,
        }}
      >
        [apply]
      </button>
    </div>
  );
}

/** Any css color -> #rrggbb for the color input. */
function themeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  // rgb()/rgba() strings
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const toHex = (n: string) => Number.parseInt(n, 10).toString(16).padStart(2, "0");
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
  }
  return "#000000";
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 100,
  },
  panel: {
    width: "100%",
    maxHeight: "88vh",
    border: "1px solid",
    borderTop: "none",
    display: "flex",
    flexDirection: "column",
    fontFamily: font.mono,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    fontSize: font.sizeSmall,
  },
  close: { background: "transparent", border: "1px solid", padding: "1px 6px", fontFamily: font.mono, fontSize: font.sizeTiny },
  body: { padding: "12px", overflow: "auto" },
  select: { fontFamily: font.mono },
  link: { background: "transparent", border: "1px solid", padding: "2px 6px", fontFamily: font.mono, fontSize: font.sizeTiny, alignSelf: "flex-start" },
  toggle: { background: "transparent", border: "1px solid", padding: "1px 8px", fontFamily: font.mono, fontSize: font.sizeTiny },
  themeRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  themeButton: { background: "transparent", border: "1px solid", padding: "2px 8px", fontFamily: font.mono, fontSize: font.sizeTiny },
  colorGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", margin: "4px 0" },
  colorSlot: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  notice: {
    margin: "10px 0 2px",
    border: "1px solid",
    padding: "4px 8px",
    fontSize: font.sizeSmall,
    whiteSpace: "pre-wrap",
  },
  footer: { padding: "6px 12px", fontSize: font.sizeTiny },
};