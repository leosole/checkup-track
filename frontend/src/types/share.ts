import type { Biomarker } from "./exam";

export type ShareStatus = "active" | "used" | "expired" | "revoked";

export interface ShareCode {
  id: number;
  code: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  status: ShareStatus;
}

export interface SharedExamSummary {
  id: number;
  title: string;
  date_performed: string;
}

export interface SharedMedicationSummary {
  id: number;
  name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export interface SharedSymptomOccurrence {
  id: number;
  start_date: string;
  end_date: string | null;
}

export interface SharedSymptom {
  id: number;
  title: string;
  occurrences: SharedSymptomOccurrence[];
}

export interface ShareGroup {
  group_key: string;
  title: string | null;
  exam_ids: number[];
  medication_use_ids: number[];
  symptom_occurrence_ids: number[];
  exams: SharedExamSummary[];
  medications: SharedMedicationSummary[];
  symptoms: SharedSymptom[];
  times_shared: number;
  last_shared_at: string;
  active_codes: number;
  codes: ShareCode[];
}

export interface ShareCreated {
  group_key: string;
  share: ShareCode;
}

export interface ShareInput {
  exam_ids: number[];
  medication_use_ids: number[];
  symptom_occurrence_ids?: number[];
  expires_in_days?: number;
}

export interface GuestShareInfo {
  owner_name: string;
  expires_at: string;
  exam_count: number;
  medication_count: number;
  symptom_count: number;
}

export interface GuestExam {
  id: number;
  title: string;
  date_performed: string;
  biomarkers: Biomarker[];
}

export interface GuestSymptomOccurrence {
  id: number;
  observation: string | null;
  start_date: string;
  end_date: string | null;
}

export interface GuestSymptom {
  id: number;
  title: string;
  occurrences: GuestSymptomOccurrence[];
}

export interface GuestMedicationUse {
  id: number;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export interface GuestMedication {
  id: number;
  name: string;
  uses: GuestMedicationUse[];
}

export interface GuestShareData {
  share: GuestShareInfo;
  exams: GuestExam[];
  medications: GuestMedication[];
  symptoms: GuestSymptom[];
}

export interface GuestAuthResponse {
  access_token: string;
  token_type: string;
  share: GuestShareInfo;
}
