import type { Medication } from "../../types";
import type { SortState } from "../ui/types";

export type MedicationStatus = "all" | "active" | "inactive";
export type MedicationSortField = "name" | "start_date";
export type MedicationSort = SortState<MedicationSortField>;

export interface MedicationFiltersProps {
  query: string;
  status: MedicationStatus;
  start_from: string;
  start_to: string;
  on_query_change: (value: string) => void;
  on_status_change: (value: MedicationStatus) => void;
  on_start_from_change: (value: string) => void;
  on_start_to_change: (value: string) => void;
}

export interface MedicationTableProps {
  medications: Medication[];
  can_delete: boolean;
  deleting_id: number | null;
  isActive: (medication: Medication) => boolean;
  sort: MedicationSort;
  on_sort_change: (field: MedicationSortField) => void;
  on_edited_medication: (id: number) => void;
  on_deleted_medication: (id: number) => void;
}
