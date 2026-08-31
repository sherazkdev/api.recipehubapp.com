import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshSession } from "@/features/auth/services/auth.service";
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
} from "@/features/auth/utils/jwt";
import { connectDb } from "@/shared/db/connect";
import { jsonOk } from "@/shared/utils/http";
import { unauthorized, serverError } from "@/shared/middleware/auth";

export async function POST() {
  try {
    await connectDb();
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return unauthorized("No refresh token");

    const tokens = await refreshSession(refreshToken);
    const response = jsonOk({ accessToken: tokens.accessToken });
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(tokens.maxAge));
    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return unauthorized("Invalid refresh token");
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to refresh" });
}
