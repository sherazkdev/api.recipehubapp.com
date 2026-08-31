import { NextRequest } from "next/server";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { saveLocalizedRecipeContent } from "@/features/recipes/services/recipe-content.service";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/features/upload/utils/validate";
import { invalidateRecipeCaches } from "@/shared/cache/invalidate";
import { connectDb } from "@/shared/db/connect";
import { badRequest, serverError, withAuth } from "@/shared/middleware/auth";
import { enforceRateLimit } from "@/shared/middleware/rate-limit";
import { jsonOk, slugify } from "@/shared/utils/http";
import { mapLimit } from "@/shared/utils/async";

export const maxDuration = 300;

const rowSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(120).optional(),
  cuisineSlug: z.string().min(1).max(80),
  prepTime: z.coerce.number().min(0).max(10_000).optional(),
  calories: z.coerce.number().min(0).max(50_000).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  servings: z.coerce.number().min(1).max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  description: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "import", 10, 60_000);
  if (limited) return limited;

  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return badRequest("CSV file is required");
      if (file.size > MAX_IMPORT_BYTES) return badRequest("CSV file too large (max 8MB)");

      const text = await file.text();
      const records = parse(text.replace(/^\uFEFF/, ""), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      if (records.length > MAX_IMPORT_ROWS) {
        return badRequest(`CSV has too many rows (max ${MAX_IMPORT_ROWS})`);
      }

      const [cuisines, existing] = await Promise.all([
        Cuisine.find().select("_id slug").lean(),
        Recipe.find().select("slug").lean(),
      ]);
      const cuisineBySlug = new Map(cuisines.map((item) => [item.slug, item]));
      const usedSlugs = new Set(existing.map((item) => item.slug));

      const results = { imported: 0, skipped: 0, errors: [] as string[] };
      const pending: Array<{
        slug: string;
        cuisineId: typeof cuisines[number]["_id"];
        prepTime: number;
        calories: number;
        difficulty: "easy" | "medium" | "hard";
        servings: number;
        status: "draft" | "published" | "archived";
        title: string;
        description: string;
      }> = [];

      for (const [index, row] of records.entries()) {
        const parsed = rowSchema.safeParse(row);
        if (!parsed.success) {
          results.skipped += 1;
          results.errors.push(`Row ${index + 2}: invalid data`);
          continue;
        }

        const cuisine = cuisineBySlug.get(parsed.data.cuisineSlug);
        if (!cuisine) {
          results.skipped += 1;
          results.errors.push(`Row ${index + 2}: cuisine "${parsed.data.cuisineSlug}" not found`);
          continue;
        }

        const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
        if (usedSlugs.has(slug)) {
          results.skipped += 1;
          results.errors.push(`Row ${index + 2}: slug "${slug}" already exists`);
          continue;
        }
        usedSlugs.add(slug);
        pending.push({
          slug,
          cuisineId: cuisine._id,
          prepTime: parsed.data.prepTime ?? 0,
          calories: parsed.data.calories ?? 0,
          difficulty: parsed.data.difficulty ?? "easy",
          servings: parsed.data.servings ?? 1,
          status: parsed.data.status ?? "draft",
          title: parsed.data.title,
          description: parsed.data.description ?? "",
        });
      }

      if (pending.length) {
        const created = await Recipe.insertMany(
          pending.map(({ title, description, ...recipe }) => recipe),
        );
        const sourceBySlug = new Map(pending.map((item) => [item.slug, item]));
        await mapLimit(created, 2, async (recipe) => {
          const source = sourceBySlug.get(recipe.slug);
          if (!source) return;
          await saveLocalizedRecipeContent(recipe._id, {
            title: source.title,
            description: source.description,
          });
        });
        results.imported = created.length;
        invalidateRecipeCaches();
      }

      return jsonOk(results);
    } catch (error) {
      console.error("CSV import error:", error);
      return serverError();
    }
  });
}