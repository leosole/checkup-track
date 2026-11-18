/**
 * Typed API client for the FastAPI backend, mirroring frontend/src/api-client.ts.
 * Tokens live in SecureStore instead of localStorage.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type {
  AuthResponse,
  CalendarData,
  Exam,
  GuestAuthResponse,
  GuestShareData,
  ManualExamInput,
  MedicationCreateInput,
  MedicationUse,
  MedicationUseUpdateInput,
  ProviderCredentialStatus,
  ProviderId,
  ShareCreated,
  ShareGroup,
  ShareInput,
  SymptomCreateInput,
  SymptomOccurrence,
  SymptomOccurrenceUpdateInput,
  TimeSeriesQuery,
  TimeSeriesResponse,
  User,
} from "./types";

const TOKEN_KEY = "vitals.jwt";
// Guests get their own token so opening a share code never disturbs an owner
// session (and vice versa).
const GUEST_TOKEN_KEY = "vitals.guest.jwt";

const FALLBACK_URL = Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";

/** Backend origin, configurable through EXPO_PUBLIC_API_URL. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || FALLBACK_URL).replace(/\/+$/, "");

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getGuestToken(): Promise<string | null> {
  return SecureStore.getItemAsync(GUEST_TOKEN_KEY);
}

export async function setGuestToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(GUEST_TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(GUEST_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
  headers?: Record<string, string>;
}

interface ErrorPayload {
  detail?: unknown;
}

async function request<T>(
  path: string,
  init: RequestOptions = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const authToken = token === undefined ? await getToken() : token;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    body: init.body,
    headers,
  });
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
    const payload = data as ErrorPayload | null;
    const detail =
      payload && payload.detail !== undefined
        ? String(payload.detail)
        : res.statusText || `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
}

export interface UploadExamOptions {
  title?: string;
  date_performed?: string;
  image_only?: boolean;
  onProgress?: (percent: number) => void;
}

export const api = {
  authConfig(): Promise<{
    google_client_id: string | null;
    test_user_enabled: boolean;
  }> {
    return request("/api/auth/config", {}, null);
  },

  testSignIn(): Promise<AuthResponse> {
    return request("/api/auth/test", { method: "POST" }, null);
  },

  googleSignIn(token: string): Promise<AuthResponse> {
    return request(
      "/api/auth/google",
      { method: "POST", body: JSON.stringify({ token }) },
      null,
    );
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

  uploadExam(file: PickedFile, options: UploadExamOptions = {}): Promise<Exam> {
    const form = new FormData();
    form.append(
      "file",
      {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as unknown as Blob,
    );
    if (options.title && options.title.trim()) {
      form.append("title", options.title.trim());
    }
    if (options.date_performed) {
      form.append("date_performed", options.date_performed);
    }
    form.append("image_only", String(Boolean(options.image_only)));

    return new Promise(async (resolve, reject) => {
      const token = await getToken();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/exams/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress?.(
            Math.round((event.loaded / event.total) * 100),
          );
        }
      };
      xhr.onerror = () => reject(new ApiError(0, "Upload connection failed."));
      xhr.onabort = () => reject(new ApiError(0, "Upload was cancelled."));
      xhr.onload = () => {
        let data: unknown = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const payload = data as ErrorPayload | null;
          const detail =
            payload && payload.detail !== undefined
              ? String(payload.detail)
              : `Upload failed (${xhr.status})`;
          reject(new ApiError(xhr.status, detail));
          return;
        }
        resolve(data as Exam);
      };
      xhr.send(form);
    });
  },

  retryExamExtraction(id: number): Promise<Exam> {
    return request(`/api/exams/${id}/retry`, { method: "POST" });
  },

  updateExam(
    id: number,
    input: {
      title?: string;
      date_performed?: string;
      laboratory?: string | null;
    },
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

  listMedications(): Promise<MedicationUse[]> {
    return request("/api/medications");
  },

  updateMedicationUse(
    id: number,
    input: MedicationUseUpdateInput,
  ): Promise<MedicationUse> {
    return request(`/api/medications/uses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  createMedication(input: MedicationCreateInput): Promise<MedicationUse[]> {
    return request("/api/medications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  deleteMedicationUse(id: number): Promise<{ deleted: number }> {
    return request(`/api/medications/uses/${id}`, { method: "DELETE" });
  },

  createSymptom(input: SymptomCreateInput): Promise<SymptomOccurrence[]> {
    return request("/api/symptoms", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateSymptomOccurrence(
    id: number,
    input: SymptomOccurrenceUpdateInput,
  ): Promise<SymptomOccurrence> {
    return request(`/api/symptoms/occurrences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteSymptomOccurrence(id: number): Promise<{ deleted: number }> {
    return request(`/api/symptoms/occurrences/${id}`, { method: "DELETE" });
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

  async guestTimeSeries(params: TimeSeriesQuery): Promise<TimeSeriesResponse> {
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
      await getGuestToken(),
    );
  },

  async guestData(): Promise<GuestShareData> {
    return request("/api/guest/data", {}, await getGuestToken());
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

  renameShareGroup(group_key: string, title: string | null): Promise<ShareGroup[]> {
    return request("/api/shares/groups", {
      method: "PATCH",
      body: JSON.stringify({ group_key, title }),
    });
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

  guestTimeSeriesWithToken(
    params: TimeSeriesQuery,
    token: string,
  ): Promise<TimeSeriesResponse> {
    const search = new URLSearchParams();
    search.set("start_date", params.start_date);
    search.set("end_date", params.end_date);
    for (const spec of params.specs) {
      search.append("specs", spec);
    }
    return request(
      `/api/guest/analytics/time-series?${search.toString()}`,
      {},
      token,
    );
  },
};
