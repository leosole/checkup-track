import type { SymptomOccurrence } from "../../types";

export type SymptomStatus = "all" | "ongoing" | "past";

/** A symptom title with its occurrences, newest first. */
export interface SymptomGroup {
  /** The symptom id shared by its occurrences. */
  id: number;
  title: string;
  occurrences: SymptomOccurrence[];
}

export interface SymptomFiltersProps {
  query: string;
  status: SymptomStatus;
  on_query_change: (value: string) => void;
  on_status_change: (value: SymptomStatus) => void;
}
