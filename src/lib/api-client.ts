import {
  clearAccessToken,
  getAccessToken,
  redirectToAdminLogin,
  setAccessToken,
} from "@/lib/auth-session";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

import type { ApiMeta } from "@/shared/types/api";

type RequestOptions = {
  auth?: boolean;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function parseResponseBody<T>(response: Response): Promise<{ data: T; meta?: ApiMeta }> {
  const payload = (await response.json()) as {
    success?: boolean;
    data?: T;
    meta?: ApiMeta;
    error?: string;
    details?: unknown;
  };

  if (!response.ok || payload.success === false) {
    if (response.status === 401) {
      clearAccessToken();
      redirectToAdminLogin("expired");
    }
    throw new ApiError(payload.error ?? "Request failed", response.status, payload.details);
  }

  return { data: payload.data as T, meta: payload.meta };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const { data } = await parseResponseBody<T>(response);
  return data;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, method = "GET", body, headers = {} } = options;
  const token = getAccessToken();

  const finalHeaders: Record<string, string> = { ...headers };
  if (body && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }
  if (auth && token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers: finalHeaders,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  return parseResponse<T>(response);
}

export async function apiGet<T>(path: string, auth = true) {
  return apiFetch<T>(path, { auth });
}

export async function apiGetWithMeta<T>(path: string, auth = true) {
  const token = getAccessToken();
  const finalHeaders: Record<string, string> = {};
  if (auth && token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: "GET",
    headers: finalHeaders,
    credentials: "include",
  });

  return parseResponseBody<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) {
  return apiFetch<T>(path, { ...options, method: "POST", body });
}

export async function apiPut<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PUT", body });
}

export async function apiDelete<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

export async function apiDownload(path: string, filename: string) {
  const token = getAccessToken();
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
      redirectToAdminLogin("expired");
    }
    throw new ApiError("Download failed", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function refreshAccessToken() {
  const data = await apiPost<{ accessToken: string }>("/api/admin/refresh", undefined, {
    auth: false,
  });
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function logout() {
  await apiPost("/api/admin/logout", undefined, { auth: false });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiPost<{ changed: boolean }>("/api/admin/change-password", payload);
}
