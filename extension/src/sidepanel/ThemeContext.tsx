/**
 * Theme + settings context — ONE source of truth.
 *
 * The previous version had a bug: `useSettings()` was called from
 * multiple components, each creating its own useState instance, so
 * color/preset changes in the settings menu never reached the
 * ThemeProvider that colors the rest of the UI. Now ThemeProvider owns
 * the single settings state and shares it via context.
 */

import React, { createContext, useContext } from "react";
import type { ThemeColors } from "./themes";
import { useSettings as useSettingsState, type PanelSettings } from "./hooks/useSettings";

export interface SettingsApi {
  settings: PanelSettings;
  theme: ThemeColors;
  setScreenshotEnabled: (enabled: boolean) => void;
  setThemeId: (themeId: PanelSettings["themeId"]) => void;
  setColor: (slot: keyof ThemeColors, value: string) => void;
  resetColors: () => void;
}

const ThemeContext = createContext<ThemeColors>(null as unknown as ThemeColors);
const SettingsContext = createContext<SettingsApi>(null as unknown as SettingsApi);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The ONE instance that owns settings state.
  const { settings, theme, setScreenshotEnabled, setThemeId, setColor, resetColors } = useSettingsState();

  const api: SettingsApi = {
    settings,
    theme,
    setScreenshotEnabled,
    setThemeId,
    setColor,
    resetColors,
  };

  return (
    <ThemeContext.Provider value={theme}>
      <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeColors {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}

export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext);
  if (!api) throw new Error("useSettings must be used inside ThemeProvider");
  return api;
}