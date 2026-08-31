import { NextRequest, NextResponse } from "next/server";
import {
  authenticateAdmin,
  issueTokens,
  loginSchema,
} from "@/features/auth/services/auth.service";
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
} from "@/features/auth/utils/jwt";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, unauthorized } from "@/shared/middleware/auth";
import { enforceRateLimit } from "@/shared/middleware/rate-limit";
import { jsonOk } from "@/shared/utils/http";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "login", 8, 10 * 60_000);
  if (limited) return limited;

  try {
    await connectDb();
    const body = await request.json();
    const parsed = loginSchema.safeParse({
      identifier: body.email ?? body.username ?? body.identifier,
      password: body.password,
    });
    if (!parsed.success) return badRequest("Email/username and password are required");

    const admin = await authenticateAdmin(parsed.data.identifier, parsed.data.password);
    if (!admin) return unauthorized("Invalid credentials");

    const tokens = issueTokens(admin);
    const response = jsonOk({
      accessToken: tokens.accessToken,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        username: admin.username,
      },
    });
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(tokens.maxAge));
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return serverError();
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to login" });
}
