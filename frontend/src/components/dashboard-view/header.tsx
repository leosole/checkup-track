import type { User } from "../../api-client";
import type { Theme } from "../../theme";
import { TbMoonFilled, TbSunLowFilled } from "react-icons/tb";
import type { DashboardRoute } from "./types";
import { Spinner } from "../ui/badge";
import { Logo } from "../logo";

interface DashboardHeaderProps {
  user: User | null;
  route: DashboardRoute;
  search_query: string;
  searching: boolean;
  theme: Theme;
  on_search_query_change: (query: string) => void;
  on_navigate: (route: DashboardRoute) => void;
  on_toggle_theme: () => void;
  on_sign_out: () => void;
}

export function DashboardHeader({
  user,
  route,
  search_query,
  searching,
  theme,
  on_search_query_change,
  on_navigate,
  on_toggle_theme,
  on_sign_out,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Go to dashboard home"
          onClick={() => on_navigate("/")}
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

        <div
          className={`relative w-full max-w-md ${route !== "/" ? "hidden" : ""}`}
        >
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={search_query}
            onChange={(event) => on_search_query_change(event.target.value)}
            placeholder="Search exams, biomarkers, ranges…"
            aria-label="Global search"
            className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-9 pr-9 text-sm text-gray-900 ring-1 ring-inset ring-transparent placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </div>

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
                  onClick={() => on_navigate("/share")}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Share data
                </button>
                <button
                  type="button"
                  onClick={() => on_navigate("/profile")}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Profile
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