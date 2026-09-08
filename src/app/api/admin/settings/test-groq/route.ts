import { NextRequest } from "next/server";
import { z } from "zod";
import { testGroqConnection } from "@/features/ai/services/groq.service";
import { getSettingsInternal } from "@/features/settings/services/settings.service";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { jsonOk } from "@/shared/utils/http";

const bodySchema = z.object({
  groqApiKey: z.string().optional(),
  recipeModel: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid test payload");

      const settings = await getSettingsInternal();
      const apiKey = parsed.data.groqApiKey?.trim() || settings.ai.groqApiKey;
      const model = parsed.data.recipeModel?.trim() || settings.ai.recipeModel;

      if (!apiKey) return badRequest("Groq API key is required");

      const result = await testGroqConnection(apiKey, model);
      return jsonOk({ ok: true, message: "Connection successful", latencyMs: result.latencyMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      return jsonOk({ ok: false, message });
    }
  });
}
