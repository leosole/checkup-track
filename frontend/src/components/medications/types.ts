import type { MedicationUse } from "../../types";

export type MedicationStatus = "all" | "ongoing" | "past";

/** A medication name with its uses, newest first. */
export interface MedicationGroup {
  /** The medication id shared by its uses. */
  id: number;
  name: string;
  uses: MedicationUse[];
}

export interface MedicationFiltersProps {
  query: string;
  status: MedicationStatus;
  on_query_change: (value: string) => void;
  on_status_change: (value: MedicationStatus) => void;
}

export interface MedicationListProps {
  groups: MedicationGroup[];
  can_edit: boolean;
  can_delete: boolean;
  on_edit: (use: MedicationUse) => void;
  on_delete: (use: MedicationUse) => void;
}
