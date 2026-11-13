import type { SymptomOccurrence } from "./symptom";

export interface CalendarExam {
  id: number;
  title: string;
  date: string;
  color: string | null;
}

export interface CalendarMedication {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  color: string | null;
}

/** A symptom occurrence: one dated episode with its own observation. */
export type CalendarSymptom = SymptomOccurrence;

export interface CalendarData {
  exams: CalendarExam[];
  medications: CalendarMedication[];
  symptoms: CalendarSymptom[];
}
