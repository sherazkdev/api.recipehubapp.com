import { z } from "zod";
import { Admin } from "@/features/auth/models/admin.model";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/features/auth/services/password.service";
import {
  parseDurationMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/features/auth/utils/jwt";
import { invalidateAuthCaches } from "@/shared/cache/invalidate";
import { getEnv } from "@/shared/config/env";

export const loginSchema = z.object({
  identifier: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

let dummyHash: string | null = null;
async function dummyPasswordHash() {
  dummyHash ??= await hashPassword("invalid-login-placeholder");
  return dummyHash;
}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => validatePassword(data.newPassword).valid, {
    message: "Password does not meet requirements",
    path: ["newPassword"],
  });

export async function authenticateAdmin(identifier: string, password: string) {
  const normalized = identifier.trim().toLowerCase();
  const admin = await Admin.findOne({
    $or: [{ email: normalized }, { username: identifier.trim() }],
    role: "admin",
  });

  if (!admin) {
    await verifyPassword(password, await dummyPasswordHash());
    return null;
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) return null;

  return admin;
}

export function issueTokens(admin: { _id: { toString(): string }; tokenVersion: number }) {
  const accessToken = signAccessToken({
    sub: admin._id.toString(),
    role: "admin",
    tokenVersion: admin.tokenVersion,
  });
  const refreshToken = signRefreshToken({
    sub: admin._id.toString(),
    tokenVersion: admin.tokenVersion,
  });
  const maxAge = parseDurationMs(getEnv().JWT_REFRESH_EXPIRES);
  return { accessToken, refreshToken, maxAge };
}

export async function refreshSession(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const admin = await Admin.findById(payload.sub);
  if (!admin || admin.tokenVersion !== payload.tokenVersion) {
    throw new Error("Invalid refresh token");
  }
  return issueTokens(admin);
}

export async function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string,
) {
  const admin = await Admin.findById(adminId);
  if (!admin) throw new Error("Admin not found");

  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }

  admin.passwordHash = await hashPassword(newPassword);
  admin.tokenVersion += 1;
  await admin.save();
  invalidateAuthCaches();
  return admin;
}
