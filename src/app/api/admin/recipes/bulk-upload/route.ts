import { NextRequest } from "next/server";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { saveUpload } from "@/features/upload/utils/storage";
import { MAX_BULK_FILES } from "@/features/upload/utils/validate";
import { invalidateRecipeCaches } from "@/shared/cache/invalidate";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { enforceRateLimit } from "@/shared/middleware/rate-limit";
import { jsonOk } from "@/shared/utils/http";
import { mapLimit } from "@/shared/utils/async";

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "bulk-upload", 20, 60_000);
  if (limited) return limited;

  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const formData = await req.formData();
      const files = formData.getAll("files").filter((item): item is File => item instanceof File);

      if (!files.length) return badRequest("At least one image file is required");
      if (files.length > MAX_BULK_FILES) {
        return badRequest(`Too many files (max ${MAX_BULK_FILES})`);
      }

      const slugs = files.map((file) =>
        file.name
          .replace(/\.[^.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-"),
      );
      const recipes = await Recipe.find({ slug: { $in: slugs } }).select("_id slug").lean();
      const recipeBySlug = new Map(recipes.map((item) => [item.slug, item]));

      const results = await mapLimit(files, 4, async (file, index) => {
        const slug = slugs[index];
        const recipe = recipeBySlug.get(slug);
        if (!recipe) {
          return { filename: file.name, slug, matched: false, error: "No recipe with this slug" };
        }
        try {
          const path = await saveUpload(file, "recipes");
          await Recipe.updateOne({ _id: recipe._id }, { $set: { imagePath: path } });
          return { filename: file.name, slug, matched: true, path };
        } catch (err) {
          return {
            filename: file.name,
            slug,
            matched: false,
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }
      });

      const matched = results.filter((row) => row.matched).length;
      if (matched) invalidateRecipeCaches();
      return jsonOk({ matched, failed: results.length - matched, results });
    } catch (error) {
      console.error("Bulk upload error:", error);
      return serverError();
    }
  });
}