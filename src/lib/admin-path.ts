export const ADMIN_BASE = "/admin";

export function adminPath(path = "") {
  if (!path) return ADMIN_BASE;
  return `${ADMIN_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function safeAdminNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/admin") || next.startsWith("/admin/login")) {
    return ADMIN_BASE;
  }
  return next;
}
