import { TbMoonFilled, TbSunLowFilled } from "react-icons/tb";
import { useNavigate } from "@tanstack/react-router";
import type { DashboardHeaderProps } from "./types";
import { Logo } from "../logo";

export function DashboardHeader({
  user,
  theme,
  on_toggle_theme,
  on_sign_out,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Go to dashboard home"
          onClick={() => void navigate({ to: "/" })}
          className="flex shrink-0 items-center gap-2.5 text-left"
        >
          <Logo className="h-9 w-9 shrink-0 rounded-xl shadow-sm" />
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
          <div className="group relative">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-2 ring-transparent transition group-hover:ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:group-hover:ring-brand-500/40"
              aria-label="Account menu"
            >
              {(user?.name || "?").charAt(0).toUpperCase()}
            </button>
            <div className="invisible absolute right-0 top-full z-40 w-56 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="rounded-xl bg-white p-3 shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/exams" })}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Exams
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/medications" })}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Medications
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/symptoms" })}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Symptoms
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/share" })}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Share data
                </button>
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/profile" })}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  API keys
                </button>
                <button
                  type="button"
                  onClick={on_sign_out}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}