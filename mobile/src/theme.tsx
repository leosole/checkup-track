import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Palette {
  brand50: string;
  brand100: string;
  brand200: string;
  brand300: string;
  brand400: string;
  brand500: string;
  brand600: string;
  brand700: string;
  brand800: string;
  brand900: string;

  bg: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;

  success: string;
  successBg: string;
  successBorder: string;
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  warning: string;
  warningBg: string;
  warningBorder: string;
  info: string;
  infoBg: string;
  infoBorder: string;
  grayBg: string;
  white: string;

  tooltipBg: string;
  tooltipText: string;
  tooltipMuted: string;
}

export const light_colors: Palette = {
  brand50: "#f5f3ff",
  brand100: "#ede9fe",
  brand200: "#ddd6fe",
  brand300: "#c4b5fd",
  brand400: "#a78bfa",
  brand500: "#8b5cf6",
  brand600: "#7c3aed",
  brand700: "#6d28d9",
  brand800: "#5b21b6",
  brand900: "#4c1d95",

  bg: "#f9fafb",
  surface: "#ffffff",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  text: "#101828",
  textMuted: "#667085",
  textSubtle: "#98a2b3",

  success: "#059669",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",
  danger: "#e11d48",
  dangerBg: "#fff1f2",
  dangerBorder: "#fecdd3",
  warning: "#b45309",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  info: "#0284c7",
  infoBg: "#f0f9ff",
  infoBorder: "#bae6fd",
  grayBg: "#f2f4f7",
  white: "#ffffff",

  tooltipBg: "#101828",
  tooltipText: "#ffffff",
  tooltipMuted: "#d0d5dd",
};

export const dark_colors: Palette = {
  brand50: "#1e1a33",
  brand100: "#2a2447",
  brand200: "#3b3166",
  brand300: "#6d5bd0",
  brand400: "#a78bfa",
  brand500: "#8b5cf6",
  brand600: "#7c3aed",
  brand700: "#c4b5fd",
  brand800: "#ddd6fe",
  brand900: "#ede9fe",

  bg: "#030712",
  surface: "#101828",
  border: "#1f2937",
  borderStrong: "#374151",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",

  success: "#34d399",
  successBg: "#052e23",
  successBorder: "#065f46",
  danger: "#fb7185",
  dangerBg: "#3f0d1c",
  dangerBorder: "#881337",
  warning: "#fbbf24",
  warningBg: "#3a2a06",
  warningBorder: "#78350f",
  info: "#38bdf8",
  infoBg: "#082f49",
  infoBorder: "#075985",
  grayBg: "#1f2937",
  white: "#ffffff",

  tooltipBg: "#1f2937",
  tooltipText: "#f9fafb",
  tooltipMuted: "#9ca3af",
};

export const radius = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 } as const;

export const shadow = {
  card: {
    shadowColor: "#101828",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;

export const SERIES_COLORS = [
  "#7c3aed",
  "#0284c7",
  "#059669",
  "#d97706",
  "#e11d48",
  "#4f46e5",
  "#0d9488",
  "#db2777",
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedMode;
  colors: Palette;
  set_mode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const THEME_KEY = "vitals.theme";
const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, set_mode] = useState<ThemeMode>("system");
  const [loaded, set_loaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system") {
          set_mode(value);
        }
      })
      .catch(() => undefined)
      .finally(() => set_loaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => undefined);
  }, [mode, loaded]);

  const resolved: ResolvedMode =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const colors = resolved === "dark" ? dark_colors : light_colors;

  const toggle = useCallback(() => {
    set_mode(resolved === "dark" ? "light" : "dark");
  }, [resolved]);

  const value = useMemo<ThemeState>(
    () => ({ mode, resolved, colors, set_mode, toggle }),
    [mode, resolved, colors, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return ctx;
}

/**
 * Rebuild a module-level StyleSheet factory whenever the palette changes.
 * Pass a stable factory: `const styles = useAppStyles(make_styles);`
 */
export function useAppStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
