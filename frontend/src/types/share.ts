import type { Biomarker } from "./exam";
import type { Medication } from "./medication";

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
}

export interface ShareGroup {
  group_key: string;
  exam_ids: number[];
  medication_ids: number[];
  exams: SharedExamSummary[];
  medications: SharedMedicationSummary[];
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
  medication_ids: number[];
  expires_in_days?: number;
}

export interface GuestShareInfo {
  owner_name: string;
  expires_at: string;
  exam_count: number;
  medication_count: number;
}

export interface GuestExam {
  id: number;
  title: string;
  date_performed: string;
  biomarkers: Biomarker[];
}

export interface GuestShareData {
  share: GuestShareInfo;
  exams: GuestExam[];
  medications: Medication[];
}

export interface GuestAuthResponse {
  access_token: string;
  token_type: string;
  share: GuestShareInfo;
}
