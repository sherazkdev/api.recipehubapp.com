import { NextRequest } from "next/server";
import { scanFoodImage } from "@/features/ai/services/groq.service";
import { logAiActivity } from "@/features/ai-activity/services/ai-activity.service";
import { getSettingsInternal } from "@/features/settings/services/settings.service";
import { connectDb } from "@/shared/db/connect";
import { badRequest, resolveAuth, serverError, unauthorized } from "@/shared/middleware/auth";
import { enforceMaintenance } from "@/shared/middleware/maintenance";
import { checkRateLimit } from "@/shared/middleware/rate-limit";
import { jsonOk } from "@/shared/utils/http";

export async function POST(request: NextRequest) {
  const started = Date.now();
  let adminId: string | undefined;
  let inputSummary = "Food photo scan";

  try {
    const auth = await resolveAuth(request);
    if (!auth) return unauthorized();

    adminId = auth.adminId;
    await connectDb();

    const maintenance = await enforceMaintenance(request, auth);
    if (maintenance) return maintenance;

    const settings = await getSettingsInternal();
    const rateError = checkRateLimit(`ai:${auth.adminId}`, settings.ai.maxRequestsPerMinute);
    if (rateError) return badRequest(rateError);

    const body = await request.json();
    const imageBase64 = String(body?.image_base64 ?? "").trim();
    const mime = String(body?.mime ?? "image/jpeg").trim();
    const language = String(body?.language ?? settings.ai.defaultLanguage).trim() || settings.ai.defaultLanguage;
    const fridgeMode = body?.fridge_mode === true;

    if (!imageBase64) return badRequest("image_base64 is required");

    const sizeMb = Buffer.byteLength(imageBase64, "base64") / (1024 * 1024);
    if (sizeMb > settings.ai.maxScanImageMb) {
      return badRequest(`Image exceeds ${settings.ai.maxScanImageMb} MB limit`);
    }

    inputSummary = fridgeMode ? "Fridge / ingredients photo" : "Finished dish photo";

    const parsed = await scanFoodImage({
      imageBase64,
      mime,
      language,
      fridgeMode,
      ai: settings.ai,
    });

    const durationMs = Date.now() - started;
    const summary =
      parsed.is_food && parsed.ingredients.length
        ? `${inputSummary} · ${parsed.ingredients.slice(0, 4).join(", ")}`
        : inputSummary;

    await logAiActivity({
      type: "scan",
      status: parsed.is_food ? "success" : "failed",
      inputSummary: summary,
      durationMs,
      error: parsed.is_food ? "" : parsed.message,
      adminId,
    });

    return jsonOk(parsed);
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "scan failed";
    await logAiActivity({
      type: "scan",
      status: "failed",
      inputSummary,
      durationMs,
      error: message,
      adminId,
    }).catch(() => undefined);

    console.error("POST /api/scan failed:", error);
    return serverError(message);
  }
}
