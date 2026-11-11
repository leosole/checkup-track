/**
 * Light/dark theme handling (Tailwind `class` strategy).
 *
 * The choice is persisted in localStorage; with nothing stored it follows the
 * OS preference. `initTheme()` runs before the first render so the page never
 * flashes the wrong palette.
 */

export type Theme = "light" | "dark";

const THEME_KEY = "checkup.theme";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Private mode / storage disabled: fall back to the OS preference.
  }
  return prefersDark() ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignoring storage failures keeps the toggle working for this session.
  }
}

export function initTheme(): Theme {
  const theme = getTheme();
  document.documentElement.classList.toggle("dark", theme === "dark");
  return theme;
}
