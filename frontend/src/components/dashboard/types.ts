import type { ReactNode } from "react";
import type { User } from "../../types";
import type { Theme } from "../../theme";
import type { DashboardState } from "./use-dashboard";

export type DashboardRoute =
  | "/"
  | "/exams"
  | "/medications"
  | "/profile"
  | "/share";

export interface DashboardProviderProps {
  children: ReactNode;
}

export interface DashboardStatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "brand" | "danger" | "success" | "gray";
}

export interface DashboardHeaderProps {
  user: User | null;
  theme: Theme;
  on_navigate: (route: DashboardRoute) => void;
  on_toggle_theme: () => void;
  on_sign_out: () => void;
}

export interface DashboardDialogsProps {
  dash: DashboardState;
  can_create_records: boolean;
  can_edit_results: boolean;
}
