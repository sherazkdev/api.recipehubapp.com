import { NextRequest, NextResponse } from "next/server";
import { Admin } from "@/features/auth/models/admin.model";
import { verifyAccessToken } from "@/features/auth/utils/jwt";
import { verifyApiKey } from "@/features/tokens/services/api-key.service";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";
import type { AuthContext } from "@/shared/types/api";

const authCache = getCache("auth-admin", 100, 20_000);

export async function resolveAuth(request: NextRequest): Promise<AuthContext | null> {
  await connectDb();

  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7);
    try {
      const payload = verifyAccessToken(token);
      const cacheKey = `${payload.sub}:${payload.tokenVersion}`;
      const cached = cacheGet<{ adminId: string }>(authCache, cacheKey);
      if (cached?.adminId) {
        return { adminId: cached.adminId, role: "admin", via: "jwt" };
      }

      const admin = await Admin.findById(payload.sub).select("_id tokenVersion").lean();
      if (!admin || admin.tokenVersion !== payload.tokenVersion) return null;
      const adminId = admin._id.toString();
      cacheSet(authCache, cacheKey, { adminId });
      return { adminId, role: "admin", via: "jwt" };
    } catch {
      return null;
    }
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const doc = await verifyApiKey(apiKey);
    if (!doc) return null;
    return { adminId: doc.adminId.toString(), role: "admin", via: "api-key" };
  }

  return null;
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ success: false, error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ success: false, error: message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function withAuth(
  request: NextRequest,
  handler: (auth: AuthContext, request: NextRequest) => Promise<NextResponse>,
) {
  const auth = await resolveAuth(request);
  if (!auth) return unauthorized();
  return handler(auth, request);
}
