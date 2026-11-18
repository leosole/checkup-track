import type { SymptomOccurrence } from "./symptom";

export interface CalendarExam {
  id: number;
  title: string;
  date: string;
}

export interface CalendarMedication {
  id: number;
  medication_id: number;
  name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export type CalendarSymptom = SymptomOccurrence;

export interface CalendarData {
  exams: CalendarExam[];
  medications: CalendarMedication[];
  symptoms: CalendarSymptom[];
}
