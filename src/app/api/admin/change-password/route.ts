import { NextRequest } from "next/server";
import { changeAdminPassword, changePasswordSchema } from "@/features/auth/services/auth.service";
import { REFRESH_COOKIE } from "@/features/auth/utils/jwt";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      await changeAdminPassword(
        auth.adminId,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );

      const response = jsonOk({ changed: true });
      response.cookies.set(REFRESH_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change password";
      if (message.includes("password")) return badRequest(message);
      console.error("Change password error:", error);
      return serverError();
    }
  });
}
