import type { Medication } from "../../types";

export type MedicationStatus = "all" | "active" | "inactive";
export type MedicationSort = "newest" | "oldest" | "name-asc" | "name-desc";

export interface MedicationFiltersProps {
  query: string;
  status: MedicationStatus;
  start_from: string;
  start_to: string;
  sort: MedicationSort;
  on_query_change: (value: string) => void;
  on_status_change: (value: MedicationStatus) => void;
  on_start_from_change: (value: string) => void;
  on_start_to_change: (value: string) => void;
  on_sort_change: (value: MedicationSort) => void;
}

export interface MedicationTableProps {
  medications: Medication[];
  can_delete: boolean;
  deleting_id: number | null;
  isActive: (medication: Medication) => boolean;
  on_edited_medication: (id: number) => void;
  on_deleted_medication: (id: number) => void;
}
