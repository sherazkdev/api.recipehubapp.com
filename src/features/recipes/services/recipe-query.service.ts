import mongoose from "mongoose";
import { z } from "zod";
import { CuisineContent } from "@/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { getActiveLanguageCodes } from "@/features/i18n/translate.service";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { escapeRegex } from "@/features/upload/utils/validate";
import { searchParamsObject } from "@/shared/http/search-params";
import type { ApiMeta } from "@/shared/types/api";
import { compactFilters } from "@/shared/utils/http";

const FALLBACK_LANG = "en";

const recipeQuerySchema = z.object({
  lang: z.string().regex(/^[a-z]{2,10}$/i, "Invalid lang").optional(),
  id: z.string().optional(),
  slug: z.string().max(120).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  cuisineId: z.string().optional(),
  cuisineSlug: z.string().max(120).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z
    .enum(["updatedAt", "-updatedAt", "title", "-title", "calories", "-calories", "prepTime", "-prepTime"])
    .optional(),
});

export type RecipeCuisineRef = {
  id: string;
  name: string;
  slug: string;
};

export type RecipeQuery = z.infer<typeof recipeQuerySchema> & { lang: string };

export type MappedRecipe = ReturnType<typeof mapRecipe> & { cuisine: RecipeCuisineRef };

export type LocalizedContent = {
  langCode: string;
  title: string;
  description: string;
  tags: string[];
  chefTips: string[];
  ingredients: Array<{ name: string; amount?: string; unit?: string }>;
  steps: Array<{
    order: number;
    title?: string;
    durationMin?: number;
    text: string;
    imagePath?: string;
  }>;
};

const NUTRITION_KEYS = [
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "saturatedFat",
  "cholesterol",
] as const;

function mapNutrition(nutrition?: Record<string, number> | null) {
  if (!nutrition) return {};
  const out: Record<string, number> = {};
  for (const key of NUTRITION_KEYS) {
    const value = nutrition[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

async function buildCuisineRefMap(cuisineIds: mongoose.Types.ObjectId[], lang: string) {
  const unique = [...new Set(cuisineIds.map((id) => id.toString()))];
  if (!unique.length) return new Map<string, RecipeCuisineRef>();

  const cuisines = await Cuisine.find({ _id: { $in: unique } }).select("slug name").lean();
  const contents = await CuisineContent.find({
    cuisineId: { $in: cuisines.map((item) => item._id) },
    langCode: { $in: [...new Set([lang, FALLBACK_LANG])] },
  })
    .select("cuisineId langCode name")
    .lean();

  const map = new Map<string, RecipeCuisineRef>();
  for (const cuisine of cuisines) {
    const id = cuisine._id.toString();
    const rows = contents.filter((item) => item.cuisineId.toString() === id);
    const preferred = rows.find((item) => item.langCode === lang);
    const fallback = rows.find((item) => item.langCode === FALLBACK_LANG);
    map.set(id, {
      id,
      name: preferred?.name ?? fallback?.name ?? cuisine.name,
      slug: cuisine.slug,
    });
  }
  return map;
}

function attachCuisine(
  recipe: ReturnType<typeof mapRecipe>,
  cuisineMap: Map<string, RecipeCuisineRef>,
): MappedRecipe {
  const cuisine =
    cuisineMap.get(recipe.cuisineId) ??
    ({
      id: recipe.cuisineId,
      name: "",
      slug: "",
    } satisfies RecipeCuisineRef);
  return { ...recipe, cuisine };
}

export function mapRecipe(recipe: {
  _id: mongoose.Types.ObjectId;
  slug: string;
  cuisineId: mongoose.Types.ObjectId;
  imagePath?: string;
  prepTime?: number;
  calories?: number;
  difficulty?: string;
  servings?: number;
  nutrition?: Record<string, number>;
  status?: string;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: recipe._id.toString(),
    slug: recipe.slug,
    cuisineId: recipe.cuisineId.toString(),
    imagePath: recipe.imagePath ?? "",
    prepTime: recipe.prepTime ?? 0,
    calories: recipe.calories ?? 0,
    difficulty: recipe.difficulty ?? "easy",
    servings: recipe.servings ?? 1,
    nutrition: mapNutrition(recipe.nutrition),
    status: recipe.status ?? "draft",
    sortOrder: recipe.sortOrder ?? 0,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

export function mapContent(doc: {
  langCode: string;
  title: string;
  description?: string;
  tags?: string[];
  chefTips?: string[];
  ingredients?: LocalizedContent["ingredients"];
  steps?: LocalizedContent["steps"];
}): LocalizedContent {
  return {
    langCode: doc.langCode,
    title: doc.title,
    description: doc.description ?? "",
    tags: doc.tags ?? [],
    chefTips: doc.chefTips ?? [],
    ingredients: doc.ingredients ?? [],
    steps: doc.steps ?? [],
  };
}

export async function parseRecipeQuery(params: URLSearchParams) {
  const parsed = recipeQuerySchema.safeParse(searchParamsObject(params));
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid query filters", details: parsed.error.flatten() };
  }

  const data = parsed.data;
  if (data.id && !mongoose.isValidObjectId(data.id)) {
    return { ok: false as const, error: "Invalid id" };
  }
  if (data.cuisineId && !mongoose.isValidObjectId(data.cuisineId)) {
    return { ok: false as const, error: "Invalid cuisineId" };
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

  return { ok: true as const, query: { ...data, lang: requested } satisfies RecipeQuery, codes };
}

export function recipeQueryCacheKey(query: RecipeQuery) {
  return [
    "list",
    query.lang,
    query.id ?? "",
    query.slug ?? "",
    query.status ?? "",
    query.cuisineId ?? "",
    query.cuisineSlug ?? "",
    query.difficulty ?? "",
    query.q?.toLowerCase() ?? "",
    query.page ?? "",
    query.limit ?? "",
    query.sort ?? "",
  ].join(":");
}

export function recipeListMeta(query: RecipeQuery, total: number, langFallback = false): ApiMeta {
  const paged = query.page != null || query.limit != null;
  const page = query.page ?? 1;
  const limit = paged ? (query.limit ?? 20) : Math.max(total, 1);
  const totalPages = paged ? Math.max(1, Math.ceil(total / limit)) : 1;

  return {
    lang: query.lang,
    fallbackLang: FALLBACK_LANG,
    langFallback,
    filters: compactFilters({
      status: query.status,
      cuisineId: query.cuisineId,
      cuisineSlug: query.cuisineSlug,
      difficulty: query.difficulty,
      q: query.q,
      slug: query.slug,
      sort: query.sort,
    }),
    pagination: { page, limit, total, totalPages, paged },
  };
}

async function resolveCuisineId(query: RecipeQuery) {
  if (query.cuisineId) return query.cuisineId;
  if (!query.cuisineSlug) return undefined;
  const cuisine = await Cuisine.findOne({ slug: query.cuisineSlug.toLowerCase() }).select("_id").lean();
  return cuisine?._id.toString() ?? null;
}

function pickLocalized(
  contents: Array<{ recipeId: mongoose.Types.ObjectId; langCode: string } & Parameters<typeof mapContent>[0]>,
  recipeId: string,
  lang: string,
) {
  const rows = contents.filter((item) => item.recipeId.toString() === recipeId);
  const preferred = rows.find((item) => item.langCode === lang);
  const fallback = rows.find((item) => item.langCode === FALLBACK_LANG);
  const used = preferred ?? fallback;
  return {
    content: used ? mapContent(used) : null,
    langFallback: !preferred && Boolean(fallback || !used),
  };
}

export async function getRecipeByQuery(query: RecipeQuery) {
  const recipe = query.id
    ? await Recipe.findById(query.id).lean()
    : await Recipe.findOne({ slug: query.slug?.toLowerCase() }).lean();
  if (!recipe) return null;

  const contents = await RecipeContent.find({
    recipeId: recipe._id,
    langCode: { $in: [...new Set([query.lang, FALLBACK_LANG])] },
  }).lean();

  const picked = pickLocalized(contents, recipe._id.toString(), query.lang);
  const content = picked.content ?? {
    langCode: query.lang,
    title: recipe.slug,
    description: "",
    tags: [],
    chefTips: [],
    ingredients: [],
    steps: [],
  };

  const cuisineMap = await buildCuisineRefMap([recipe.cuisineId], query.lang);
  const base = mapRecipe(recipe);

  return {
    item: {
      ...attachCuisine(base, cuisineMap),
      lang: content.langCode,
      langFallback: picked.langFallback,
      title: content.title,
      content,
      contents: [content],
    },
    langFallback: picked.langFallback,
  };
}

export async function listRecipesByQuery(
  query: RecipeQuery,
): Promise<
  | { error: string }
  | {
      items: Array<
        MappedRecipe & { title: string; description: string; tags: string[]; lang: string; langFallback: boolean }
      >;
      total: number;
      langFallback: boolean;
    }
> {
  const cuisineId = await resolveCuisineId(query);
  if (cuisineId === null) {
    return { error: "Cuisine not found" as const };
  }

  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (cuisineId) filter.cuisineId = cuisineId;

  if (query.q) {
    const matches = await RecipeContent.find({
      langCode: { $in: [...new Set([query.lang, FALLBACK_LANG])] },
      title: { $regex: escapeRegex(query.q), $options: "i" },
    })
      .select("recipeId")
      .lean();
    filter._id = { $in: [...new Set(matches.map((item) => item.recipeId.toString()))] };
  }

  const paged = query.page != null || query.limit != null;
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const sortKey = query.sort;
  const titleSort = sortKey === "title" || sortKey === "-title";

  const mongoSort: Record<string, 1 | -1> =
    sortKey === "calories"
      ? { calories: 1 }
      : sortKey === "-calories"
        ? { calories: -1 }
        : sortKey === "prepTime"
          ? { prepTime: 1 }
          : sortKey === "-prepTime"
            ? { prepTime: -1 }
            : sortKey === "updatedAt"
              ? { updatedAt: 1 }
              : sortKey === "-updatedAt"
                ? { updatedAt: -1 }
                : { sortOrder: 1, updatedAt: -1 };

  const total = await Recipe.countDocuments(filter);
  const listQuery = Recipe.find(filter)
    .select("slug cuisineId imagePath prepTime calories difficulty servings status sortOrder createdAt updatedAt")
    .sort(titleSort ? { updatedAt: -1 } : mongoSort);
  if (paged && !titleSort) {
    listQuery.skip((page - 1) * limit).limit(limit);
  }
  const recipes = await listQuery.lean();

  const cuisineMap = await buildCuisineRefMap(
    recipes.map((recipe) => recipe.cuisineId),
    query.lang,
  );

  const contents = await RecipeContent.find({
    recipeId: { $in: recipes.map((recipe) => recipe._id) },
    langCode: { $in: [...new Set([query.lang, FALLBACK_LANG])] },
  })
    .select("recipeId langCode title description tags chefTips ingredients steps")
    .lean();

  let items = recipes.map((recipe) => {
    const picked = pickLocalized(contents, recipe._id.toString(), query.lang);
    const content = picked.content;
    return {
      ...attachCuisine(mapRecipe(recipe), cuisineMap),
      title: content?.title ?? recipe.slug,
      description: content?.description ?? "",
      tags: content?.tags ?? [],
      lang: content?.langCode ?? query.lang,
      langFallback: picked.langFallback,
    };
  });

  if (titleSort) {
    items.sort((a, b) => a.title.localeCompare(b.title) * (sortKey === "-title" ? -1 : 1));
    if (paged) items = items.slice((page - 1) * limit, page * limit);
  }

  const langFallback = items.some((item) => item.langFallback);
  return { items, total, langFallback };
}
