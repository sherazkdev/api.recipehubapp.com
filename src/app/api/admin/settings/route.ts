import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSettingsForAdmin,
  updateAiSettings,
  updateGeneralSettings,
} from "@/features/settings/services/settings.service";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

const generalSchema = z.object({
  appName: z.string().min(1).optional(),
  supportEmail: z.string().min(3).optional(),
  defaultLanguage: z.string().min(2).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
  allowedIps: z.string().optional(),
});

const aiSchema = z.object({
  groqApiKey: z.string().optional(),
  recipeModel: z.string().min(1).optional(),
  visionModel: z.string().min(1).optional(),
  defaultLanguage: z.string().min(1).optional(),
  maxRequestsPerMinute: z.number().int().min(1).max(500).optional(),
  maxScanImageMb: z.number().min(1).max(20).optional(),
  foodOnlyMode: z.boolean().optional(),
  includeNutrition: z.boolean().optional(),
  minSteps: z.number().int().min(1).max(20).optional(),
  maxSteps: z.number().int().min(1).max(30).optional(),
  imageSource: z.enum(["pollinations", "none"]).optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      await connectDb();
      return jsonOk(await getSettingsForAdmin());
    } catch (error) {
      console.error("Get settings error:", error);
      return serverError();
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const section = String(body.section ?? "").trim();

      if (section === "general") {
        const parsed = generalSchema.safeParse(body.data);
        if (!parsed.success) return badRequest("Invalid general settings");
        return jsonOk({ general: await updateGeneralSettings(parsed.data) });
      }

      if (section === "ai") {
        const parsed = aiSchema.safeParse(body.data);
        if (!parsed.success) return badRequest("Invalid AI settings");
        return jsonOk({ ai: await updateAiSettings(parsed.data) });
      }

      return badRequest("section must be general or ai");
    } catch (error) {
      console.error("Update settings error:", error);
      return serverError();
    }
  });
}
