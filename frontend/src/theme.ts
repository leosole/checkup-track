/**
 * Light/dark theme handling (Tailwind `class` strategy).
 *
 * The choice is persisted in localStorage; with nothing stored it follows the
 * OS preference. `init_theme()` runs before the first render so the page never
 * flashes the wrong palette.
 */

export type Theme = "light" | "dark";

const THEME_KEY = "checkup.theme";

function prefers_dark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function get_theme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Private mode / storage disabled: fall back to the OS preference.
  }
  return prefers_dark() ? "dark" : "light";
}

export function apply_theme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignoring storage failures keeps the toggle working for this session.
  }
}

export function init_theme(): Theme {
  const theme = get_theme();
  document.documentElement.classList.toggle("dark", theme === "dark");
  return theme;
}
