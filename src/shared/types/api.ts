export type ApiPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  paged: boolean;
};

export type ApiMeta = {
  lang?: string;
  fallbackLang?: string;
  langFallback?: boolean;
  filters?: Record<string, string | number | boolean>;
  pagination?: ApiPaginationMeta;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
};

export type ApiError = {
  success: false;
  error: string;
  details?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function fail(error: string, details?: unknown): ApiError {
  return { success: false, error, details };
}

export type AuthContext = {
  adminId: string;
  role: "admin";
  via: "jwt" | "api-key";
};
