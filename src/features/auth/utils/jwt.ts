import jwt from "jsonwebtoken";
import { getEnv } from "@/shared/config/env";

export type AccessPayload = {
  sub: string;
  role: "admin";
  tokenVersion: number;
  type: "access";
};

export type RefreshPayload = {
  sub: string;
  tokenVersion: number;
  type: "refresh";
};

export function signAccessToken(payload: Omit<AccessPayload, "type">) {
  const { JWT_SECRET, JWT_ACCESS_EXPIRES } = getEnv();
  return jwt.sign({ ...payload, type: "access" }, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: Omit<RefreshPayload, "type">) {
  const { JWT_SECRET, JWT_REFRESH_EXPIRES } = getEnv();
  return jwt.sign({ ...payload, type: "refresh" }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const { JWT_SECRET } = getEnv();
  const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;
  if (payload.type !== "access") throw new Error("Invalid token type");
  return payload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const { JWT_SECRET } = getEnv();
  const payload = jwt.verify(token, JWT_SECRET) as RefreshPayload;
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return payload;
}

export const REFRESH_COOKIE = "rh_refresh";

export function refreshCookieOptions(maxAgeMs: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeMs,
  };
}

export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 86_400_000);
}
