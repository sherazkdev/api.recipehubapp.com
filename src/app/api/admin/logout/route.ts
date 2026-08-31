import { NextResponse } from "next/server";
import { REFRESH_COOKIE } from "@/features/auth/utils/jwt";
import { jsonOk } from "@/shared/utils/http";

export async function POST() {
  const response = jsonOk({ loggedOut: true });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
