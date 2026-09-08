import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { saveLocalizedRecipeContent } from "@/features/recipes/services/recipe-content.service";
import {
  getRecipeByQuery,
  listRecipesByQuery,
  mapRecipe,
  parseRecipeQuery,
  recipeListMeta,
  recipeQueryCacheKey,
} from "@/features/recipes/services/recipe-query.service";
import { isSafeImagePath } from "@/features/upload/utils/validate";
import { invalidateRecipeCaches } from "@/shared/cache/invalidate";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";
import { badRequest, notFound, serverError, withAuth } from "@/shared/middleware/auth";
import { enforceMaintenance } from "@/shared/middleware/maintenance";
import type { ApiMeta } from "@/shared/types/api";
import { compactFilters, jsonMedia, jsonOk, slugify } from "@/shared/utils/http";
import { applyReorder, nextSortOrder, parseReorderIds } from "@/shared/utils/reorder";

const listCache = getCache("recipe-list", 40, 20_000);

export const maxDuration = 120;

const recipeSchema = z.object({
  slug: z.string().max(120).optional(),
  cuisineId: z.string().refine((value) => mongoose.isValidObjectId(value), "Invalid cuisine"),
  imagePath: z
    .string()
    .max(500)
    .refine((value) => isSafeImagePath(value), "Invalid image path")
    .optional(),
  imageUrl: z
    .string()
    .max(500)
    .refine((value) => isSafeImagePath(value), "Invalid image url")
    .optional(),
  prepTime: z.number().optional(),
  calories: z.number().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  servings: z.number().optional(),
  nutrition: z
    .object({
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      fiber: z.number().optional(),
      sugar: z.number().optional(),
      sodium: z.number().optional(),
      saturatedFat: z.number().optional(),
      cholesterol: z.number().optional(),
    })
    .optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  content: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      chefTips: z.array(z.string()).optional(),
      ingredients: z
        .array(
          z.object({
            name: z.string(),
            amount: z.string().optional(),
            unit: z.string().optional(),
          }),
        )
        .optional(),
      steps: z
        .array(
          z.object({
            order: z.number(),
            title: z.string().optional(),
            durationMin: z.number().optional(),
            text: z.string(),
            imagePath: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, req) => {
    try {
      await connectDb();
      const maintenance = await enforceMaintenance(request, auth);
      if (maintenance) return maintenance;

      const parsed = await parseRecipeQuery(req.nextUrl.searchParams);
      if (!parsed.ok) return badRequest(parsed.error, "details" in parsed ? parsed.details : undefined);

      const { query } = parsed;
      const cacheKey = recipeQueryCacheKey(query);
      const cached = cacheGet<{ item?: unknown; items?: unknown[]; meta: ApiMeta }>(listCache, cacheKey);
      if (cached?.item) return jsonMedia(req, cached.item, undefined, cached.meta);
      if (cached?.items) return jsonMedia(req, cached.items, undefined, cached.meta);

      if (query.id || query.slug) {
        const found = await getRecipeByQuery(query);
        if (!found) return notFound("Recipe not found");
        const meta = {
          lang: query.lang,
          fallbackLang: "en",
          langFallback: found.langFallback,
          filters: compactFilters({ id: query.id, slug: query.slug }),
        };
        cacheSet(listCache, cacheKey, { item: found.item, meta });
        return jsonMedia(req, found.item, undefined, meta);
      }

      const listed = await listRecipesByQuery(query);
      if ("error" in listed) return badRequest(listed.error ?? "Invalid filters");

      const meta = recipeListMeta(query, listed.total, listed.langFallback);
      cacheSet(listCache, cacheKey, { items: listed.items, meta });
      return jsonMedia(req, listed.items, undefined, meta);
    } catch (error) {
      console.error("List recipes error:", error);
      return serverError();
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const parsed = recipeSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid recipe data", parsed.error.flatten());

      const slug =
        parsed.data.slug?.trim() ||
        slugify(parsed.data.content?.title ?? `recipe-${Date.now()}`);

      const recipe = await Recipe.create({
        slug,
        cuisineId: parsed.data.cuisineId,
        imagePath: parsed.data.imagePath || parsed.data.imageUrl || "",
        prepTime: parsed.data.prepTime ?? 0,
        calories: parsed.data.calories ?? 0,
        difficulty: parsed.data.difficulty ?? "easy",
        servings: parsed.data.servings ?? 1,
        nutrition: parsed.data.nutrition ?? {},
        status: parsed.data.status ?? "draft",
        sortOrder: parsed.data.sortOrder ?? (await nextSortOrder(Recipe)),
      });

      invalidateRecipeCaches();
      if (parsed.data.content) {
        await saveLocalizedRecipeContent(recipe._id, {
          title: parsed.data.content.title,
          description: parsed.data.content.description,
          tags: parsed.data.content.tags,
          chefTips: parsed.data.content.chefTips,
          ingredients: parsed.data.content.ingredients,
          steps: parsed.data.content.steps,
        });
      }

      return jsonMedia(req, mapRecipe(recipe.toObject()));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return badRequest("Recipe slug already exists");
      }
      console.error("Create recipe error:", error);
      return serverError();
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const reorderIds = parseReorderIds(body.reorder);
      if (reorderIds) {
        if (!reorderIds.length) return badRequest("reorder must be an array of ids");
        await applyReorder(Recipe, reorderIds);
        invalidateRecipeCaches();
        return jsonOk({ reordered: true, count: reorderIds.length });
      }

      const id = body.id as string;
      if (!id || !mongoose.isValidObjectId(id)) return badRequest("Invalid id");

      const parsed = recipeSchema.partial().safeParse(body);
      if (!parsed.success) return badRequest("Invalid recipe data");

      const { content, imageUrl, ...recipeFields } = parsed.data;
      if (imageUrl && !recipeFields.imagePath) recipeFields.imagePath = imageUrl;
      const recipe = await Recipe.findByIdAndUpdate(id, recipeFields, {
        new: true,
        lean: true,
      });
      if (!recipe) return notFound("Recipe not found");
      invalidateRecipeCaches();

      if (content?.title) {
        await saveLocalizedRecipeContent(recipe._id, {
          title: content.title,
          description: content.description,
          tags: content.tags,
          chefTips: content.chefTips,
          ingredients: content.ingredients,
          steps: content.steps,
        });
      }

      return jsonMedia(req, mapRecipe(recipe));
    } catch (error) {
      console.error("Update recipe error:", error);
      return serverError();
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");
      if (!id || !mongoose.isValidObjectId(id)) return badRequest("Invalid id");

      const recipe = await Recipe.findByIdAndDelete(id);
      if (!recipe) return notFound("Recipe not found");
      await RecipeContent.deleteMany({ recipeId: recipe._id });
      invalidateRecipeCaches();
      return jsonOk({ deleted: true });
    } catch (error) {
      console.error("Delete recipe error:", error);
      return serverError();
    }
  });
}
