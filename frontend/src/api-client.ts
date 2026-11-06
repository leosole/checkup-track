/**
 * Typed fetch client for the FastAPI backend.
 * Every protected call attaches `Authorization: Bearer <TOKEN>`.
 */

export interface User {
  id: string;
  email: string;
  name: string;
}

export type ProviderId =
  | "gemini"
  | "groq"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "mistral"
  | "openrouter";

export interface ProviderCredentialStatus {
  provider: ProviderId;
  configured: boolean;
  order: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Biomarker {
  id: number;
  biomarker_name: string;
  value: number;
  unit: string;
  reference_range: string | null;
  is_abnormal: boolean;
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

export interface ExamProcessing {
  status: "queued" | "processing" | "completed" | "failed";
  stage: string;
  completed_chunks: number;
  total_chunks: number;
  retry_allowed: boolean;
  updated_at: string;
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

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export interface MedicationInput {
  medication_name: string;
  dosage: string;
  frequency_per_day: number;
  start_date: string;
  end_date: string | null;
}

export interface CalendarExam {
  id: number;
  title: string;
  date: string;
}

export interface CalendarMedication {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface CalendarData {
  exams: CalendarExam[];
  medications: CalendarMedication[];
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  is_abnormal: boolean;
  exam_title: string;
}

export interface TimeSeries {
  spec: string;
  unit: string;
  points: TimeSeriesPoint[];
}

export interface TimeSeriesResponse {
  series: TimeSeries[];
}

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

const TOKEN_KEY = "vitals.jwt";
// Guests get their own token so opening a share code never disturbs an owner
// session (and vice versa).
const GUEST_TOKEN_KEY = "vitals.guest.jwt";

export function get_token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function set_token(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function get_guest_token(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function set_guest_token(token: string | null): void {
  if (token) {
    localStorage.setItem(GUEST_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token: string | null = get_token(),
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const api = {
  auth_config(): Promise<{ google_client_id: string | null }> {
    return request("/api/auth/config");
  },

  google_sign_in(token: string): Promise<AuthResponse> {
    return request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  me(): Promise<User> {
    return request("/api/auth/me");
  },

  provider_credentials(): Promise<ProviderCredentialStatus[]> {
    return request("/api/profile/providers");
  },

  save_provider_key(
    provider: ProviderId,
    api_key: string,
  ): Promise<ProviderCredentialStatus[]> {
    return request(`/api/profile/providers/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ api_key }),
    });
  },

  delete_provider_key(provider: ProviderId): Promise<void> {
    return request(`/api/profile/providers/${provider}`, { method: "DELETE" });
  },

  update_provider_order(
    providers: ProviderId[],
  ): Promise<ProviderCredentialStatus[]> {
    return request("/api/profile/providers/order", {
      method: "PUT",
      body: JSON.stringify({ providers }),
    });
  },

  list_exams(): Promise<Exam[]> {
    return request("/api/exams");
  },

  search_exams(q: string): Promise<Exam[]> {
    return request(`/api/exams/search?q=${encodeURIComponent(q)}`);
  },

  async upload_exam(
    file: File,
    title?: string,
    on_progress?: (percent: number) => void,
  ): Promise<Exam> {
    const form = new FormData();
    form.append("file", file);
    if (title && title.trim()) {
      form.append("title", title.trim());
    }
    const token = get_token();
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/exams/upload");
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          on_progress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onerror = () => reject(new ApiError(0, "Upload connection failed."));
      request.onabort = () => reject(new ApiError(0, "Upload was cancelled."));
      request.onload = () => {
        let data: unknown = null;
        try {
          data = JSON.parse(request.responseText);
        } catch {
          data = null;
        }
        if (request.status < 200 || request.status >= 300) {
          const detail =
            data && typeof data === "object" && "detail" in data
              ? String((data as { detail: unknown }).detail)
              : `Upload failed (${request.status})`;
          reject(new ApiError(request.status, detail));
          return;
        }
        resolve(data as Exam);
      };
      request.send(form);
    });
  },

  retry_exam_extraction(id: number): Promise<Exam> {
    return request(`/api/exams/${id}/retry`, { method: "POST" });
  },

  async exam_pdf(id: number): Promise<Blob> {
    const headers = new Headers();
    const token = get_token();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`/api/exams/${id}/pdf`, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(res.status, detail || `Could not open the PDF (${res.status})`);
    }
    return res.blob();
  },

  update_exam(
    id: number,
    input: { title?: string; date_performed?: string },
  ): Promise<Exam> {
    return request(`/api/exams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  save_manual_exam_results(id: number, input: ManualExamInput): Promise<Exam> {
    return request(`/api/exams/${id}/manual`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  delete_exam(id: number): Promise<{ deleted: number }> {
    return request(`/api/exams/${id}`, { method: "DELETE" });
  },

  list_medications(): Promise<Medication[]> {
    return request("/api/medications");
  },

  update_medication(
    id: number,
    input: Partial<MedicationInput>,
  ): Promise<Medication> {
    return request(`/api/medications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  create_medication(input: MedicationInput): Promise<Medication> {
    return request("/api/medications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  delete_medication(id: number): Promise<{ deleted: number }> {
    return request(`/api/medications/${id}`, { method: "DELETE" });
  },

  calendar(): Promise<CalendarData> {
    return request("/api/calendar");
  },

  time_series(params: {
    start_date: string;
    end_date: string;
    specs: string[];
  }): Promise<TimeSeriesResponse> {
    const search = new URLSearchParams();
    search.set("start_date", params.start_date);
    search.set("end_date", params.end_date);
    for (const spec of params.specs) {
      search.append("specs", spec);
    }
    return request(`/api/analytics/time-series?${search.toString()}`);
  },

  create_share(input: {
    exam_ids: number[];
    medication_ids: number[];
    expires_in_days?: number;
  }): Promise<ShareCreated> {
    return request("/api/shares", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  list_share_groups(): Promise<ShareGroup[]> {
    return request("/api/shares");
  },

  revoke_share(id: number): Promise<void> {
    return request(`/api/shares/${id}`, { method: "DELETE" });
  },

  redeem_share_code(code: string): Promise<GuestAuthResponse> {
    // Public endpoint: never attach an owner token here.
    return request(
      "/api/shares/redeem",
      { method: "POST", body: JSON.stringify({ code }) },
      null,
    );
  },

  guest_data(): Promise<GuestShareData> {
    return request("/api/guest/data", {}, get_guest_token());
  },

  async guest_exam_pdf(id: number): Promise<Blob> {
    const headers = new Headers();
    const token = get_guest_token();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`/api/guest/exams/${id}/pdf`, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(res.status, detail || `Could not open the PDF (${res.status})`);
    }
    return res.blob();
  },
};
