import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@/shared/cache/lru";
import { badRequest } from "@/shared/middleware/auth";

type RateEntry = { count: number; windowStart: number };

const ipRateCache = getCache("ip-rate", 500, 120_000);
const aiRateCache = getCache("ai-rate", 500, 120_000);

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function readEntry(cache: ReturnType<typeof getCache>, key: string): RateEntry | undefined {
  return cache.get(key) as RateEntry | undefined;
}

export function enforceRateLimit(
  request: NextRequest,
  bucket: string,
  max: number,
  windowMs: number,
): NextResponse | null {
  const key = `${bucket}:${clientIp(request)}`;
  const now = Date.now();
  const entry = readEntry(ipRateCache, key);

  if (!entry || now - entry.windowStart >= windowMs) {
    ipRateCache.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (entry.count >= max) {
    return badRequest("Too many requests. Please try again later.");
  }

  ipRateCache.set(key, { count: entry.count + 1, windowStart: entry.windowStart });
  return null;
}

export function checkRateLimit(key: string, maxPerMinute: number): string | null {
  if (maxPerMinute < 1) return null;

  const now = Date.now();
  const entry = readEntry(aiRateCache, key);

  if (!entry || now - entry.windowStart >= 60_000) {
    aiRateCache.set(key, { count: 1, windowStart: now });
    return null;
  }

  if (entry.count >= maxPerMinute) {
    return `Rate limit exceeded (${maxPerMinute} requests per minute)`;
  }

  aiRateCache.set(key, { count: entry.count + 1, windowStart: entry.windowStart });
  return null;
}
