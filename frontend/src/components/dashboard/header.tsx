import { TbMoonFilled, TbSunLowFilled } from "react-icons/tb";
import { HiChevronUp } from "react-icons/hi2";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { DashboardHeaderProps } from "./types";
import { Logo } from "../logo";

const MENU_LINKS = [
  { label: "Exams", to: "/exams" },
  { label: "Medications", to: "/medications" },
  { label: "Symptoms", to: "/symptoms" },
  { label: "Share data", to: "/share" },
  { label: "API keys", to: "/profile" },
] as const;

export function DashboardHeader({
  user,
  theme,
  on_toggle_theme,
  on_sign_out,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [open, set_open] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const full_name = user?.name ?? "";
  const initial = (full_name || "?").charAt(0).toUpperCase();
  /** Everything after the first letter; the letter itself is the travelling one. */
  const name_rest = full_name.slice(1);

  // Behave like a dropdown: close on outside pointer press or Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) set_open(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") set_open(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function go(to: (typeof MENU_LINKS)[number]["to"]) {
    set_open(false);
    void navigate({ to });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/90">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Go to dashboard home"
          onClick={() => void navigate({ to: "/" })}
          className="flex shrink-0 items-center gap-2.5 text-left"
        >
          <Logo className="h-9 w-9 shrink-0 rounded-xl shadow-xs" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              CheckUpTrack
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Health dashboard</p>
          </div>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={on_toggle_theme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {theme === "dark" ? (
              <TbSunLowFilled className="h-5 w-5" aria-hidden="true" />
            ) : (
              <TbMoonFilled className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          {/* The account circle grows into the menu, like the dashboard's + button. */}
          <div ref={container} className="relative h-9 w-9">
            <div
              className={[
                "absolute right-0 top-0 z-40 overflow-hidden",
                "transition-[width,height,border-radius,background-color,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
                open
                  ? "h-[17rem] w-64 rounded-2xl bg-white shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10"
                  : "h-9 w-9 rounded-[1.125rem] bg-brand-100 shadow-none dark:bg-brand-500/20",
              ].join(" ")}
            >
              {/* One letter in both states: centred in the circle, then carried into
                  the first letter of the name, where it is restyled in place. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute flex items-center justify-center font-semibold leading-5",
                  "transition-[left,top,width,height,color] duration-300 ease-in-out motion-reduce:transition-none",
                  open
                    ? "left-2 top-3 h-5 w-[0.66em] text-sm text-gray-900 dark:text-white"
                    : "left-0 top-0 h-9 w-9 text-sm text-brand-700 dark:text-brand-200",
                ].join(" ")}
              >
                {initial}
              </span>

              <div
                inert={!open}
                aria-hidden={!open}
                className={[
                  "flex h-full flex-col p-2 transition-opacity ease-out motion-reduce:transition-none",
                  open
                    ? "opacity-100 duration-200 delay-100"
                    : "opacity-0 duration-100",
                ].join(" ")}
              >
                <div className="min-w-0 pb-2 pr-8 pt-1">
                  <p className="truncate text-sm font-semibold leading-5 text-gray-900 dark:text-white">
                    {/* Transparent copy of the letter: it reserves the exact advance
                        the travelling letter lands on. */}
                    <span className="text-transparent">{initial}</span>
                    {name_rest}
                  </p>
                  <p className="truncate text-xs leading-4 text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
                <div className="mb-1 border-t border-gray-100 dark:border-gray-800" />
                {MENU_LINKS.map((link) => (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => go(link.to)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium leading-5 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {link.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={on_sign_out}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium leading-5 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Sign out
                </button>
              </div>

              {/* Covers the collapsed circle so the whole avatar opens the menu. */}
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={open}
                title="Account menu"
                onClick={() => set_open((value) => !value)}
                className={[
                  "absolute inset-0 z-10 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  open ? "pointer-events-none" : "",
                ].join(" ")}
              />

              {/* Chevron pointing to the top-right corner closes the menu. */}
              <button
                type="button"
                onClick={() => set_open(false)}
                aria-label="Close account menu"
                title="Close account menu"
                className={[
                  "absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200",
                  open
                    ? "opacity-100 delay-150 duration-200"
                    : "pointer-events-none opacity-0 duration-100",
                ].join(" ")}
              >
                <HiChevronUp
                  aria-hidden="true"
                  className="h-4 w-4 rotate-45"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
