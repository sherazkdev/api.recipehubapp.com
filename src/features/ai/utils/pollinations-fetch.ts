import { createHash } from "crypto";
import { pollinationsAuthHeaders } from "@/features/ai/utils/pollinations-auth";

const CACHE_HEADER_KEYS = [
  "content-type",
  "content-length",
  "cache-control",
  "age",
  "cf-cache-status",
  "x-cache",
  "server",
  "via",
];

export function redactPollinationsUrl(url: string) {
  return url.replace(/seed=\d+/g, "seed=REDACTED");
}

export function sha256Short(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

/** Full URL must include query string — used for recipe hero images only. */
export function assertPollinationsUrlHasQuery(fullUrl: string) {
  const parsed = new URL(fullUrl);
  if (!parsed.search || parsed.search.length <= 1) {
    throw new Error("Pollinations URL missing query parameters");
  }
  if (!parsed.searchParams.get("model")) {
    throw new Error("Pollinations URL missing model parameter");
  }
}

export async function fetchPollinationsImage(fullUrl: string) {
  assertPollinationsUrlHasQuery(fullUrl);

  const started = Date.now();
  const response = await fetch(fullUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
    headers: {
      Accept: "image/*",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...pollinationsAuthHeaders(),
    },
  });
  const ms = Date.now() - started;

  const headers: Record<string, string> = {};
  for (const key of CACHE_HEADER_KEYS) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const requestParsed = new URL(fullUrl);
  const finalParsed = new URL(response.url);
  const queryPreservedOnRedirect = finalParsed.search === requestParsed.search;

  return {
    ok: response.ok,
    status: response.status,
    ms,
    requestedUrl: fullUrl,
    requestedUrlRedacted: redactPollinationsUrl(fullUrl),
    finalUrl: response.url,
    finalUrlRedacted: redactPollinationsUrl(response.url),
    redirected: response.url !== fullUrl,
    queryPreservedOnRedirect,
    /** Request URL model= only — not proof of upstream execution (Pollinations may cache by prompt+seed). */
    requestModel: requestParsed.searchParams.get("model"),
    /** Echo of model= on final URL after redirect — not executed-model proof. */
    finalModelParam: finalParsed.searchParams.get("model"),
    contentType: response.headers.get("content-type") ?? "",
    headers,
    buffer,
    sha256_16: buffer.length ? sha256Short(buffer) : "",
  };
}
