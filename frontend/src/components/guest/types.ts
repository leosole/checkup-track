import type { FormEvent } from "react";
import type { GuestExam, Medication } from "../../types";

export interface CodeEntryProps {
  code: string;
  error: string | null;
  submitting: boolean;
  on_code_change: (value: string) => void;
  on_submit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface ExamsSectionProps {
  exams: GuestExam[];
  plot_markers: string[];
  on_toggle_marker: (name: string) => void;
  on_open_pdf: (exam_id: number) => void;
}

export interface MedicationsSectionProps {
  medications: Medication[];
}
