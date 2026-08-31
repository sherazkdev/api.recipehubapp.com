import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { z } from "zod";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { isSafeImagePath } from "@/features/upload/utils/validate";
import { invalidateCatalogCaches } from "@/shared/cache/invalidate";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";
import { badRequest, notFound, serverError, withAuth } from "@/shared/middleware/auth";
import { compactFilters, jsonOk, slugify } from "@/shared/utils/http";
import { applyReorder, nextSortOrder, parseReorderIds } from "@/shared/utils/reorder";

const catalogCache = getCache("catalog", 20, 120_000);

const cuisineSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  imagePath: z.string().max(500).refine((value) => isSafeImagePath(value), "Invalid image path").optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const params = req.nextUrl.searchParams;
      const id = params.get("id")?.trim();
      const slug = params.get("slug")?.trim().toLowerCase();
      const q = params.get("q")?.trim().toLowerCase();
      if (id && !mongoose.isValidObjectId(id)) return badRequest("Invalid id");

      const cached = cacheGet<{ items: unknown[] }>(catalogCache, "cuisines");
      const items =
        cached?.items ??
        (await Cuisine.find().sort({ sortOrder: 1, name: 1 }).lean()).map((item) => ({
          id: item._id.toString(),
          name: item.name,
          slug: item.slug,
          imagePath: item.imagePath,
          description: item.description,
          sortOrder: item.sortOrder ?? 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
      if (!cached?.items) cacheSet(catalogCache, "cuisines", { items });

      const filtered = items.filter((item) => {
        const row = item as { id: string; name: string; slug: string; description?: string };
        if (id && row.id !== id) return false;
        if (slug && row.slug !== slug) return false;
        if (q) {
          const haystack = `${row.name} ${row.slug} ${row.description ?? ""}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

      return jsonOk(filtered, undefined, {
        filters: compactFilters({ id, slug, q }),
      });
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
        imagePath: parsed.data.imagePath ?? "",
        description: parsed.data.description ?? "",
        sortOrder: parsed.data.sortOrder ?? (await nextSortOrder(Cuisine)),
      });

      invalidateCatalogCaches();
      return jsonOk({
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        imagePath: doc.imagePath,
        description: doc.description,
        sortOrder: doc.sortOrder ?? 0,
      });
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

      const update: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.name && !parsed.data.slug) {
        update.slug = slugify(parsed.data.name);
      }

      const doc = await Cuisine.findByIdAndUpdate(id, update, { returnDocument: "after" });
      if (!doc) return notFound("Cuisine not found");
      invalidateCatalogCaches();

      return jsonOk({
        id: doc._id.toString(),
        name: doc.name,
        slug: doc.slug,
        imagePath: doc.imagePath,
        description: doc.description,
        sortOrder: doc.sortOrder ?? 0,
      });
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
      invalidateCatalogCaches();
      return jsonOk({ deleted: true });
    } catch (error) {
      console.error("Delete cuisine error:", error);
      return serverError();
    }
  });
}
