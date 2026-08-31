import { NextRequest } from "next/server";
import { saveUpload } from "@/features/upload/utils/storage";
import { safeSubdir } from "@/features/upload/utils/validate";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { enforceRateLimit } from "@/shared/middleware/rate-limit";
import { jsonOk } from "@/shared/utils/http";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "upload", 40, 60_000);
  if (limited) return limited;

  return withAuth(request, async (_, req) => {
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      const subdir = safeSubdir(String(formData.get("subdir") || "recipes"));

      if (!(file instanceof File)) {
        return badRequest("file is required");
      }

      const path = await saveUpload(file, subdir);
      return jsonOk({ path, url: `/uploads/${path}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      if (message.includes("too large") || message.includes("Only JPG")) {
        return badRequest(message);
      }
      console.error("Upload error:", error);
      return serverError();
    }
  });
}