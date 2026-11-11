export interface Biomarker {
  id: number;
  biomarker_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface ExamProcessing {
  status: "queued" | "processing" | "completed" | "failed";
  stage: string;
  completed_chunks: number;
  total_chunks: number;
  retry_allowed: boolean;
  updated_at: string;
}

export interface Exam {
  id: number;
  title: string;
  date_performed: string;
  pdf_path: string;
  markdown_path: string;
  biomarkers: Biomarker[];
  extraction_error: string | null;
  processing: ExamProcessing | null;
}

export interface ManualBiomarkerInput {
  biomarker_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface ManualExamInput {
  title: string;
  date_performed: string;
  biomarkers: ManualBiomarkerInput[];
}
