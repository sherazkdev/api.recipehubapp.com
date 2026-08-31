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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function attachImageUrls<T>(origin: string, value: T): T {
  const seen = new WeakSet<object>();

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;
    if (seen.has(node)) return node;
    seen.add(node);

    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      next[key] = walk(child);
    }
    if ("imagePath" in node) {
      next.imageUrl = toImageUrl(origin, typeof node.imagePath === "string" ? node.imagePath : "");
    }
    return next;
  };

  return walk(value) as T;
}
