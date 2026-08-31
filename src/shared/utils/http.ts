import { NextRequest, NextResponse } from "next/server";
import { attachImageUrls, publicOrigin } from "@/shared/http/media-url";
import { ok, type ApiMeta } from "@/shared/types/api";

export function jsonOk<T>(data: T, init?: ResponseInit, meta?: ApiMeta) {
  return NextResponse.json(ok(data, meta), init);
}

export function jsonMedia<T>(request: NextRequest, data: T, init?: ResponseInit, meta?: ApiMeta) {
  return jsonOk(attachImageUrls(publicOrigin(request), data), init, meta);
}

export function compactFilters(filters: Record<string, string | number | boolean | undefined | null>) {
  return Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];
      return value !== undefined && value !== null && value !== "";
    }),
  );
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
