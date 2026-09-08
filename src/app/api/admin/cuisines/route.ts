import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { CuisineContent } from "@/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { saveLocalizedCuisineContent } from "@/features/cuisines/services/cuisine-content.service";
import {
  cuisineListMeta,
  cuisineQueryCacheKey,
  getCuisineByQuery,
  listCuisinesByQuery,
  mapCuisine,
  parseCuisineQuery,
} from "@/features/cuisines/services/cuisine-query.service";
import { isSafeImagePath } from "@/features/upload/utils/validate";
import { invalidateCatalogCaches } from "@/shared/cache/invalidate";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";
import { badRequest, notFound, serverError, withAuth } from "@/shared/middleware/auth";
import { enforceMaintenance } from "@/shared/middleware/maintenance";
import type { ApiMeta } from "@/shared/types/api";
import { compactFilters, jsonMedia, jsonOk, slugify } from "@/shared/utils/http";
import { applyReorder, nextSortOrder, parseReorderIds } from "@/shared/utils/reorder";

const listCache = getCache("cuisine-list", 20, 20_000);

export const maxDuration = 120;

const cuisineSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  imagePath: z.string().max(500).refine((value) => isSafeImagePath(value), "Invalid image path").optional(),
  imageUrl: z.string().max(500).refine((value) => isSafeImagePath(value), "Invalid image url").optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, req) => {
    try {
      await connectDb();
      const maintenance = await enforceMaintenance(request, auth);
      if (maintenance) return maintenance;

      const parsed = await parseCuisineQuery(req.nextUrl.searchParams);
      if (!parsed.ok) return badRequest(parsed.error, "details" in parsed ? parsed.details : undefined);

      const { query } = parsed;
      const cacheKey = cuisineQueryCacheKey(query);
      const cached = cacheGet<{ item?: unknown; items?: unknown[]; meta: ApiMeta }>(listCache, cacheKey);
      if (cached?.item) return jsonMedia(req, cached.item, undefined, cached.meta);
      if (cached?.items) return jsonMedia(req, cached.items, undefined, cached.meta);

      if (query.id || query.slug) {
        const found = await getCuisineByQuery(query);
        if (!found) return notFound("Cuisine not found");
        const meta = {
          lang: query.lang,
          fallbackLang: "en",
          langFallback: found.langFallback,
          filters: compactFilters({ id: query.id, slug: query.slug }),
        };
        cacheSet(listCache, cacheKey, { item: found.item, meta });
        return jsonMedia(req, found.item, undefined, meta);
      }

      const listed = await listCuisinesByQuery(query);
      const meta = cuisineListMeta(query, listed.total, listed.langFallback);
      cacheSet(listCache, cacheKey, { items: listed.items, meta });
      return jsonMedia(req, listed.items, undefined, meta);
    } catch (error) {
      console.error("List cuisines error:", error);
      return serverError();
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const parsed = cuisineSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid cuisine data");

      const slug = parsed.data.slug?.trim() || slugify(parsed.data.name);
      const doc = await Cuisine.create({
        name: parsed.data.name,
        slug,
        imagePath: parsed.data.imagePath || parsed.data.imageUrl || "",
        description: parsed.data.description ?? "",
        sortOrder: parsed.data.sortOrder ?? (await nextSortOrder(Cuisine)),
      });

      invalidateCatalogCaches();
      await saveLocalizedCuisineContent(doc._id, {
        name: doc.name,
        description: doc.description,
      });

      return jsonMedia(req, mapCuisine(doc.toObject()));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return badRequest("Cuisine slug already exists");
      }
      console.error("Create cuisine error:", error);
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
        await applyReorder(Cuisine, reorderIds);
        invalidateCatalogCaches();
        return jsonOk({ reordered: true, count: reorderIds.length });
      }

      const id = body.id as string;
      if (!id || !mongoose.isValidObjectId(id)) return badRequest("Invalid id");

      const parsed = cuisineSchema.partial().safeParse(body);
      if (!parsed.success) return badRequest("Invalid cuisine data");

      const { imageUrl, ...fields } = parsed.data;
      const update: Record<string, unknown> = { ...fields };
      if (imageUrl && !fields.imagePath) update.imagePath = imageUrl;
      if (parsed.data.name && !parsed.data.slug) {
        update.slug = slugify(parsed.data.name);
      }

      const doc = await Cuisine.findByIdAndUpdate(id, update, { returnDocument: "after" });
      if (!doc) return notFound("Cuisine not found");
      invalidateCatalogCaches();

      if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
        await saveLocalizedCuisineContent(doc._id, {
          name: doc.name,
          description: doc.description,
        });
      }

      return jsonMedia(req, mapCuisine(doc.toObject()));
    } catch (error) {
      console.error("Update cuisine error:", error);
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

      const doc = await Cuisine.findByIdAndDelete(id);
      if (!doc) return notFound("Cuisine not found");
      await CuisineContent.deleteMany({ cuisineId: doc._id });
      invalidateCatalogCaches();
      return jsonOk({ deleted: true });
    } catch (error) {
      console.error("Delete cuisine error:", error);
      return serverError();
    }
  });
}
