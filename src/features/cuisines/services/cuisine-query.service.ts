import mongoose from "mongoose";
import { z } from "zod";
import { CuisineContent } from "@/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { ensureEnglishCuisineContents } from "@/features/cuisines/services/cuisine-content.service";
import { getActiveLanguageCodes } from "@/features/i18n/translate.service";
import { searchParamsObject } from "@/shared/http/search-params";
import type { ApiMeta } from "@/shared/types/api";
import { compactFilters } from "@/shared/utils/http";

const FALLBACK_LANG = "en";

const cuisineQuerySchema = z.object({
  lang: z.string().regex(/^[a-z]{2,10}$/i, "Invalid lang").optional(),
  id: z.string().optional(),
  slug: z.string().max(120).optional(),
  q: z.string().max(120).optional(),
});

export type CuisineQuery = z.infer<typeof cuisineQuerySchema> & { lang: string };

export function mapCuisine(cuisine: {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  imagePath?: string;
  description?: string;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: cuisine._id.toString(),
    name: cuisine.name,
    slug: cuisine.slug,
    imagePath: cuisine.imagePath ?? "",
    description: cuisine.description ?? "",
    sortOrder: cuisine.sortOrder ?? 0,
    createdAt: cuisine.createdAt,
    updatedAt: cuisine.updatedAt,
  };
}

export async function parseCuisineQuery(params: URLSearchParams) {
  const parsed = cuisineQuerySchema.safeParse(searchParamsObject(params));
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid query filters", details: parsed.error.flatten() };
  }

  const data = parsed.data;
  if (data.id && !mongoose.isValidObjectId(data.id)) {
    return { ok: false as const, error: "Invalid id" };
  }

  const requested = (data.lang ?? FALLBACK_LANG).toLowerCase();
  const codes = await getActiveLanguageCodes();
  if (!codes.includes(requested)) {
    return {
      ok: false as const,
      error: `Unsupported lang "${requested}". Use an active language from GET /admin/languages?isActive=true.`,
      details: { lang: requested, active: codes },
    };
  }

  return { ok: true as const, query: { ...data, lang: requested } satisfies CuisineQuery, codes };
}

export function cuisineQueryCacheKey(query: CuisineQuery) {
  return ["cuisines", query.lang, query.id ?? "", query.slug ?? "", query.q?.toLowerCase() ?? ""].join(":");
}

export function cuisineListMeta(query: CuisineQuery, _total: number, langFallback = false): ApiMeta {
  return {
    lang: query.lang,
    fallbackLang: FALLBACK_LANG,
    langFallback,
    filters: compactFilters({
      q: query.q,
      slug: query.slug,
    }),
  };
}

function pickLocalized(
  contents: Array<{ cuisineId: mongoose.Types.ObjectId; langCode: string; name: string; description?: string }>,
  cuisineId: string,
  lang: string,
) {
  const rows = contents.filter((item) => item.cuisineId.toString() === cuisineId);
  const preferred = rows.find((item) => item.langCode === lang);
  const fallback = rows.find((item) => item.langCode === FALLBACK_LANG);
  const used = preferred ?? fallback;
  return {
    name: used?.name,
    description: used?.description,
    langCode: used?.langCode,
    langFallback: !preferred && Boolean(fallback || !used),
  };
}

function localizeCuisine(
  cuisine: Parameters<typeof mapCuisine>[0],
  contents: Parameters<typeof pickLocalized>[0],
  lang: string,
) {
  const picked = pickLocalized(contents, cuisine._id.toString(), lang);
  return {
    ...mapCuisine(cuisine),
    name: picked.name ?? cuisine.name,
    description: picked.description ?? cuisine.description ?? "",
    lang: picked.langCode ?? lang,
    langFallback: picked.langFallback,
  };
}

async function loadContents(cuisineIds: mongoose.Types.ObjectId[], lang: string) {
  if (!cuisineIds.length) return [];
  return CuisineContent.find({
    cuisineId: { $in: cuisineIds },
    langCode: { $in: [...new Set([lang, FALLBACK_LANG])] },
  })
    .select("cuisineId langCode name description")
    .lean();
}

export async function getCuisineByQuery(query: CuisineQuery) {
  await ensureEnglishCuisineContents();
  const cuisine = query.id
    ? await Cuisine.findById(query.id).lean()
    : await Cuisine.findOne({ slug: query.slug?.toLowerCase() }).lean();
  if (!cuisine) return null;

  const contents = await loadContents([cuisine._id], query.lang);
  const item = localizeCuisine(cuisine, contents, query.lang);
  return { item, langFallback: item.langFallback };
}

export async function listCuisinesByQuery(query: CuisineQuery) {
  await ensureEnglishCuisineContents();
  const cuisines = await Cuisine.find().sort({ sortOrder: 1, name: 1 }).lean();
  const contents = await loadContents(
    cuisines.map((item) => item._id),
    query.lang,
  );

  let items = cuisines.map((cuisine) => localizeCuisine(cuisine, contents, query.lang));
  if (query.q) {
    const needle = query.q.toLowerCase();
    items = items.filter((item) => {
      const haystack = `${item.name} ${item.slug} ${item.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  const langFallback = items.some((item) => item.langFallback);
  return { items, total: items.length, langFallback };
}
