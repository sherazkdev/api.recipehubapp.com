import { NextRequest } from "next/server";
import { getDashboardData } from "@/features/dashboard/dashboard.service";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";
import { serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

const dashboardCache = getCache("dashboard", 20, 30_000);

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    try {
      const cached = cacheGet<{ data: Awaited<ReturnType<typeof getDashboardData>> }>(
        dashboardCache,
        auth.adminId,
      );
      if (cached?.data) return jsonOk(cached.data);

      await connectDb();
      const data = await getDashboardData(auth.adminId);
      cacheSet(dashboardCache, auth.adminId, { data });
      return jsonOk(data);
    } catch (error) {
      console.error("Dashboard error:", error);
      return serverError();
    }
  });
}
