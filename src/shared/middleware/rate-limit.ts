import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function tooManyRequests(message = "Too many requests. Try again shortly.") {
  return NextResponse.json({ success: false, error: message }, { status: 429 });
}

export function enforceRateLimit(
  request: NextRequest,
  name: string,
  limit: number,
  windowMs: number,
) {
  const key = `${name}:${clientIp(request)}`;
  if (allowRequest(key, limit, windowMs)) return null;
  return tooManyRequests();
}