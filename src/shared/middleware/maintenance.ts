import { NextRequest, NextResponse } from "next/server";
import { getSettingsInternal, isMaintenanceBlocked } from "@/features/settings/services/settings.service";
import type { AuthContext } from "@/shared/types/api";
import { connectDb } from "@/shared/db/connect";
import { badRequest } from "@/shared/middleware/auth";

export function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Blocks mobile/API-key traffic during maintenance. JWT admin sessions may continue. */
export async function enforceMaintenance(
  request: NextRequest,
  auth: AuthContext | null,
): Promise<NextResponse | null> {
  if (auth?.via === "jwt") return null;

  await connectDb();
  const settings = await getSettingsInternal();
  if (!isMaintenanceBlocked(clientIp(request), settings.general)) return null;

  return badRequest(settings.general.maintenanceMessage || "Service unavailable");
}
