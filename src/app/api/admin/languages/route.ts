import mongoose from "mongoose";
import { after, NextRequest } from "next/server";
import { z } from "zod";
import {
  backfillCuisineLanguageContent,
  deleteCuisineLanguageContent,
} from "@/features/cuisines/services/cuisine-content.service";
import { Language } from "@/features/languages/models/language.model";
import {
  backfillLanguageContent,
  deleteLanguageContent,
} from "@/features/recipes/services/recipe-content.service";
import { invalidateCatalogCaches } from "@/shared/cache/invalidate";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { connectDb } from "@/shared/db/connect";

const catalogCache = getCache("catalog", 20, 120_000);
import { badRequest, notFound, serverError, withAuth } from "@/shared/middleware/auth";
import { compactFilters, jsonOk } from "@/shared/utils/http";
import { applyReorder, nextSortOrder, parseReorderIds } from "@/shared/utils/reorder";

export const maxDuration = 300;

const languageSchema = z.object({
  code: z.string().regex(/^[a-z]{2,10}$/i, "Use a 2-10 letter language code"),
  name: z.string().min(1),
  nativeName: z.string().optional(),
  flag: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const isActive = req.nextUrl.searchParams.get("isActive")?.trim();
      if (isActive && !["true", "false"].includes(isActive)) {
        return badRequest("isActive must be true or false");
      }

      const cached = cacheGet<{ items: unknown[] }>(catalogCache, "languages");
      const items =
        cached?.items ??
        (await Language.find().sort({ sortOrder: 1, name: 1 }).lean()).map((item) => ({
          id: item._id.toString(),
          code: item.code,
          name: item.name,
          nativeName: item.nativeName,
          flag: item.flag,
          isActive: item.isActive,
          sortOrder: item.sortOrder ?? 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
      if (!cached?.items) cacheSet(catalogCache, "languages", { items });

      const filtered =
        isActive == null
          ? items
          : items.filter((item) => Boolean((item as { isActive?: boolean }).isActive) === (isActive === "true"));

      return jsonOk(filtered, undefined, {
        filters: compactFilters({ isActive: isActive === "true" ? true : isActive === "false" ? false : undefined }),
      });
    } catch (error) {
      console.error("List languages error:", error);
      return serverError();
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      await connectDb();
      const body = await req.json();
      const parsed = languageSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid language data");

      const doc = await Language.create({
        code: parsed.data.code.toLowerCase(),
        name: parsed.data.name,
        nativeName: parsed.data.nativeName ?? "",
        flag: parsed.data.flag ?? "",
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? (await nextSortOrder(Language)),
      });

      invalidateCatalogCaches();
      if (doc.isActive && doc.code !== "en") {
        after(() => {
          void (async () => {
            await backfillLanguageContent(doc.code);
            await backfillCuisineLanguageContent(doc.code);
          })().catch((error) => {
            console.error("Language backfill error:", error);
          });
        });
      }

      return jsonOk({
        id: doc._id.toString(),
        code: doc.code,
        name: doc.name,
        nativeName: doc.nativeName,
        flag: doc.flag,
        isActive: doc.isActive,
        sortOrder: doc.sortOrder ?? 0,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return badRequest("Language code already exists");
      }
      console.error("Create language error:", error);
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
        await applyReorder(Language, reorderIds);
        invalidateCatalogCaches();
        return jsonOk({ reordered: true, count: reorderIds.length });
      }

      const id = body.id as string;
      if (!id || !mongoose.isValidObjectId(id)) return badRequest("Invalid id");

      const parsed = languageSchema.partial().omit({ code: true }).safeParse(body);
      if (!parsed.success) return badRequest("Invalid language data");

      const existing = await Language.findById(id);
      if (!existing) return notFound("Language not found");
      if (existing.code === "en" && parsed.data.isActive === false) {
        return badRequest("English cannot be deactivated");
      }

      const doc = await Language.findByIdAndUpdate(id, parsed.data, { returnDocument: "after" });
      if (!doc) return notFound("Language not found");

      invalidateCatalogCaches();
      if (doc.isActive && !existing.isActive && doc.code !== "en") {
        after(() => {
          void (async () => {
            await backfillLanguageContent(doc.code);
            await backfillCuisineLanguageContent(doc.code);
          })().catch((error) => {
            console.error("Language backfill error:", error);
          });
        });
      }

      return jsonOk({
        id: doc._id.toString(),
        code: doc.code,
        name: doc.name,
        nativeName: doc.nativeName,
        flag: doc.flag,
        isActive: doc.isActive,
        sortOrder: doc.sortOrder ?? 0,
      });
    } catch (error) {
      console.error("Update language error:", error);
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

      const existing = await Language.findById(id);
      if (!existing) return notFound("Language not found");
      if (existing.code === "en") return badRequest("English cannot be deleted");

      const doc = await Language.findByIdAndDelete(id);
      if (!doc) return notFound("Language not found");
      await deleteLanguageContent(doc.code);
      await deleteCuisineLanguageContent(doc.code);
      invalidateCatalogCaches();
      return jsonOk({ deleted: true });
    } catch (error) {
      console.error("Delete language error:", error);
      return serverError();
    }
  });
}
