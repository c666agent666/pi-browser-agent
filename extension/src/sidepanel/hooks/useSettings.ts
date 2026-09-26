/**
 * Panel settings (client-side, persisted in localStorage):
 * - screenshotEnabled: gate the screenshot/vision UI (the agent itself
 *   reads the page's HTML/CSS/JS directly, so screenshots are optional)
 * - themeId + customColors: appearance
 */

import { useCallback, useEffect, useState } from "react";
import { resolveTheme, type ThemeColors, type ThemeId } from "../themes";

const STORAGE_KEY = "pi-agent-settings";

export interface PanelSettings {
  screenshotEnabled: boolean;
  themeId: ThemeId;
  customColors: Partial<ThemeColors>;
}

const DEFAULTS: PanelSettings = {
  screenshotEnabled: true,
  themeId: "nebula",
  customColors: {},
};

function load(): PanelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PanelSettings>;
    return {
      screenshotEnabled: parsed.screenshotEnabled ?? DEFAULTS.screenshotEnabled,
      themeId: parsed.themeId ?? DEFAULTS.themeId,
      customColors: parsed.customColors ?? {},
    };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<PanelSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage full/unavailable — settings just won't persist
    }
  }, [settings]);

  const setScreenshotEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, screenshotEnabled: enabled }));
  }, []);

  const setThemeId = useCallback((themeId: ThemeId) => {
    setSettings(prev => ({ ...prev, themeId, customColors: {} }));
  }, []);

  const setColor = useCallback((slot: keyof ThemeColors, value: string) => {
    setSettings(prev => ({ ...prev, customColors: { ...prev.customColors, [slot]: value } }));
  }, []);

  const resetColors = useCallback(() => {
    setSettings(prev => ({ ...prev, customColors: {} }));
  }, []);

  const theme = resolveTheme(settings.themeId, settings.customColors);

  return {
    settings,
    theme,
    setScreenshotEnabled,
    setThemeId,
    setColor,
    resetColors,
  };
}