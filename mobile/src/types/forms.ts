export interface MedicationUseDraft {
  start_date: string;
  end_date: string;
  ongoing: boolean;
  dosage: string;
  frequency_per_day: string;
}

export interface SymptomDateDraft {
  start_date: string;
  end_date: string;
  ongoing: boolean;
  observation: string;
}

export interface ManualBiomarkerRow {
  biomarker_name: string;
  value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
}

export interface CalendarSelection {
  kind: "exam" | "medication" | "symptom";
  id: number;
}
