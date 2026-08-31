const STORAGE_KEY = "rh_access_token";
const listeners = new Set<() => void>();

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

let accessToken: string | null = readStoredToken();

export function getAccessToken() {
  return accessToken ?? readStoredToken();
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function subscribeAccessToken(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function redirectToAdminLogin(reason?: string) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (reason) params.set("reason", reason);
  const query = params.toString();
  window.location.href = `/admin/login${query ? `?${query}` : ""}`;
}
