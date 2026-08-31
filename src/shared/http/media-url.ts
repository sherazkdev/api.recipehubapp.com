import { NextRequest } from "next/server";

export function publicOrigin(request: NextRequest) {
  const configured = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    request.nextUrl.host;
  return `${proto}://${host}`;
}

export function toImageUrl(origin: string, path?: string | null) {
  const value = (path ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const rel = value.startsWith("/") ? value : `/uploads/${value}`;
  return `${origin}${rel}`;
}

export function attachImageUrls<T>(origin: string, value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => attachImageUrls(origin, item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    next[key] = attachImageUrls(origin, child);
  }
  if ("imagePath" in obj) {
    next.imageUrl = toImageUrl(origin, typeof obj.imagePath === "string" ? obj.imagePath : "");
  }
  return next as T;
}
