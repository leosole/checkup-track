import { createContext, useContext } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "../../auth-context";
import { useDashboard, type DashboardState } from "./use-dashboard";
import type { DashboardProviderProps, DashboardRoute } from "./types";

const DASHBOARD_ROUTES: DashboardRoute[] = [
  "/",
  "/exams",
  "/medications",
  "/symptoms",
  "/profile",
  "/share",
];

const DashboardContext = createContext<DashboardState | null>(null);

/** Owns the data, dialog and UI state every signed-in page shares. */
export function DashboardProvider({ children }: DashboardProviderProps) {
  const { user } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const route =
    DASHBOARD_ROUTES.find((candidate) => candidate === pathname) ?? "/";
  const dash = useDashboard(route, user);

  return (
    <DashboardContext.Provider value={dash}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardState(): DashboardState {
  const dash = useContext(DashboardContext);
  if (!dash) {
    throw new Error("useDashboardState must be used inside DashboardProvider");
  }
  return dash;
}
