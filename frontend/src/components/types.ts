import type { Exam, Medication } from "../types";

export interface LogoProps {
  className?: string;
}

export interface UploadExamModalProps {
  open: boolean;
  on_close: () => void;
  on_saved: (exam: Exam) => void;
}

export interface MedicationModalProps {
  open: boolean;
  /** Medication being edited; null means "create a new one". */
  med?: Medication | null;
  onClose: () => void;
  on_saved: () => void;
}

export interface ManualExamModalProps {
  exam: Exam | null;
  on_close: () => void;
  on_keep_pdf: () => void;
  on_saved: (exam: Exam) => void;
}

export interface BiomarkerDraft {
  biomarker_name: string;
  value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
}

export type CalendarSelection =
  | { kind: "exam"; exam: Exam }
  | { kind: "medication"; medication: Medication };

export interface CalendarItemModalProps {
  item: CalendarSelection | null;
  error: string | null;
  busy: boolean;
  retry_error: string | null;
  retrying_exam_id: number | null;
  plot_markers: string[];
  on_toggle_marker: (name: string) => void;
  on_close: () => void;
  on_edit: () => void;
  on_delete: () => void;
  on_download: () => void;
  on_retry_exam: (id: number) => void;
}

export interface ExamRenameModalProps {
  exam: Exam | null;
  on_close: () => void;
  on_saved: () => Promise<void>;
}
