/**
 * Typed fetch client for the FastAPI backend.
 * Every protected call attaches `Authorization: Bearer <TOKEN>`.
 */

import type {
  AuthResponse,
  CalendarData,
  Exam,
  GuestAuthResponse,
  GuestShareData,
  ManualExamInput,
  Medication,
  MedicationInput,
  ProviderCredentialStatus,
  ProviderId,
  ShareCreated,
  ShareGroup,
  ShareInput,
  TimeSeriesQuery,
  TimeSeriesResponse,
  User,
} from "./types";

const TOKEN_KEY = "vitals.jwt";
// Guests get their own token so opening a share code never disturbs an owner
// session (and vice versa).
const GUEST_TOKEN_KEY = "vitals.guest.jwt";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getGuestToken(): string | null {
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

export function setGuestToken(token: string | null): void {
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
  token: string | null = getToken(),
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
  authConfig(): Promise<{
    google_client_id: string | null;
    test_user_enabled: boolean;
  }> {
    return request("/api/auth/config");
  },

  testSignIn(): Promise<AuthResponse> {
    return request("/api/auth/test", { method: "POST" });
  },

  googleSignIn(token: string): Promise<AuthResponse> {
    return request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  me(): Promise<User> {
    return request("/api/auth/me");
  },

  providerCredentials(): Promise<ProviderCredentialStatus[]> {
    return request("/api/profile/providers");
  },

  saveProviderKey(
    provider: ProviderId,
    api_key: string,
  ): Promise<ProviderCredentialStatus[]> {
    return request(`/api/profile/providers/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ api_key }),
    });
  },

  deleteProviderKey(provider: ProviderId): Promise<void> {
    return request(`/api/profile/providers/${provider}`, { method: "DELETE" });
  },

  updateProviderOrder(
    providers: ProviderId[],
  ): Promise<ProviderCredentialStatus[]> {
    return request("/api/profile/providers/order", {
      method: "PUT",
      body: JSON.stringify({ providers }),
    });
  },

  listExams(): Promise<Exam[]> {
    return request("/api/exams");
  },

  searchExams(q: string): Promise<Exam[]> {
    return request(`/api/exams/search?q=${encodeURIComponent(q)}`);
  },

  async upload_exam(
    file: File,
    title?: string,
    on_progress?: (percent: number) => void,
    date_performed?: string,
    image_only = false,
  ): Promise<Exam> {
    const form = new FormData();
    form.append("file", file);
    if (title && title.trim()) {
      form.append("title", title.trim());
    }
    if (date_performed) {
      form.append("date_performed", date_performed);
    }
    form.append("image_only", String(image_only));
    const token = getToken();
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/api/exams/upload");
      if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          on_progress?.(Math.round((event.loaded / event.total) * 100));
        }
      };
      request.onerror = () =>
        reject(new ApiError(0, "Upload connection failed."));
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

  retryExamExtraction(id: number): Promise<Exam> {
    return request(`/api/exams/${id}/retry`, { method: "POST" });
  },

  async exam_pdf(id: number): Promise<Blob> {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`/api/exams/${id}/pdf`, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(
        res.status,
        detail || `Could not open the PDF (${res.status})`,
      );
    }
    return res.blob();
  },

  updateExam(
    id: number,
    input: { title?: string; date_performed?: string },
  ): Promise<Exam> {
    return request(`/api/exams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  saveManualExamResults(id: number, input: ManualExamInput): Promise<Exam> {
    return request(`/api/exams/${id}/manual`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  deleteExam(id: number): Promise<{ deleted: number }> {
    return request(`/api/exams/${id}`, { method: "DELETE" });
  },

  listMedications(): Promise<Medication[]> {
    return request("/api/medications");
  },

  updateMedication(
    id: number,
    input: Partial<MedicationInput>,
  ): Promise<Medication> {
    return request(`/api/medications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  createMedication(input: MedicationInput): Promise<Medication> {
    return request("/api/medications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteMedication(id: number): Promise<{ deleted: number }> {
    return request(`/api/medications/${id}`, { method: "DELETE" });
  },

  calendar(): Promise<CalendarData> {
    return request("/api/calendar");
  },

  timeSeries(params: TimeSeriesQuery): Promise<TimeSeriesResponse> {
    const search = new URLSearchParams();
    search.set("start_date", params.start_date);
    search.set("end_date", params.end_date);
    for (const spec of params.specs) {
      search.append("specs", spec);
    }
    return request(`/api/analytics/time-series?${search.toString()}`);
  },

  guestTimeSeries(params: TimeSeriesQuery): Promise<TimeSeriesResponse> {
    const search = new URLSearchParams();
    search.set("start_date", params.start_date);
    search.set("end_date", params.end_date);
    for (const spec of params.specs) {
      search.append("specs", spec);
    }
    // Read-only guest session: never attach the owner token here.
    return request(
      `/api/guest/analytics/time-series?${search.toString()}`,
      {},
      getGuestToken(),
    );
  },

  createShare(input: ShareInput): Promise<ShareCreated> {
    return request("/api/shares", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listShareGroups(): Promise<ShareGroup[]> {
    return request("/api/shares");
  },

  revokeShare(id: number): Promise<void> {
    return request(`/api/shares/${id}`, { method: "DELETE" });
  },

  redeemShareCode(code: string): Promise<GuestAuthResponse> {
    // Public endpoint: never attach an owner token here.
    return request(
      "/api/shares/redeem",
      { method: "POST", body: JSON.stringify({ code }) },
      null,
    );
  },

  guestData(): Promise<GuestShareData> {
    return request("/api/guest/data", {}, getGuestToken());
  },

  async guestExamPdf(id: number): Promise<Blob> {
    const headers = new Headers();
    const token = getGuestToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`/api/guest/exams/${id}/pdf`, { headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ApiError(
        res.status,
        detail || `Could not open the PDF (${res.status})`,
      );
    }
    return res.blob();
  },
};
