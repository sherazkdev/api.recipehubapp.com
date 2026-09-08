import { NextRequest } from "next/server";
import { generateRecipe } from "@/features/ai/services/groq.service";
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
  let inputSummary = "";

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
    const prompt = String(body?.prompt ?? "").trim();
    const language = String(body?.language ?? settings.ai.defaultLanguage).trim() || settings.ai.defaultLanguage;
    inputSummary = prompt.slice(0, 500);

    if (!prompt) return badRequest("prompt is required");

    const recipe = await generateRecipe({ prompt, language, ai: settings.ai });
    const durationMs = Date.now() - started;

    if (!recipe || Object.keys(recipe).length === 0) {
      await logAiActivity({
        type: "generate",
        status: "failed",
        inputSummary,
        durationMs,
        error: "Empty recipe response",
        adminId,
      });
      return jsonOk({});
    }

    await logAiActivity({
      type: "generate",
      status: "success",
      inputSummary,
      durationMs,
      adminId,
    });

    return jsonOk(recipe);
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "chat failed";
    await logAiActivity({
      type: "generate",
      status: "failed",
      inputSummary,
      durationMs,
      error: message,
      adminId,
    }).catch(() => undefined);

    console.error("POST /api/chat failed:", error);
    return serverError(message);
  }
}
