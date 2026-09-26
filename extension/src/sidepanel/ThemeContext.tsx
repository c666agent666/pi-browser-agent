/**
 * Theme context — every component reads the resolved ThemeColors from
 * here instead of importing a static palette, so presets and color-wheel
 * changes apply instantly.
 */

import React, { createContext, useContext } from "react";
import type { ThemeColors } from "./themes";
import { useSettings } from "./hooks/useSettings";

const ThemeContext = createContext<ThemeColors>(null as unknown as ThemeColors);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useSettings();
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}