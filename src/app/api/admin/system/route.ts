import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDb } from "@/shared/db/connect";
import { getEnv } from "@/shared/config/env";
import { serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      await connectDb();
      const env = getEnv();
      const dbState = mongoose.connection.readyState;
      const dbLabels: Record<number, string> = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      };

      return jsonOk({
        status: dbState === 1 ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        services: {
          database: {
            status: dbLabels[dbState] ?? "unknown",
            name: mongoose.connection.name,
          },
          api: { status: "operational" },
          storage: { status: "local", path: env.UPLOAD_DIR },
        },
        version: process.env.npm_package_version ?? "0.1.0",
      });
    } catch (error) {
      console.error("System status error:", error);
      return serverError();
    }
  });
}
