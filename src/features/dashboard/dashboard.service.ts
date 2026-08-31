import mongoose from "mongoose";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { Language } from "@/features/languages/models/language.model";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { ApiKey } from "@/features/tokens/models/token.model";

export type DashboardSlice = {
  label: string;
  value: number;
  color?: string;
  emphasis?: boolean;
};

export type DashboardTrendPoint = {
  month: string;
  current: number;
  previous: number;
};

export type DashboardRecentRecipe = {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string;
  cuisine: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardData = {
  stats: {
    recipes: number;
    published: number;
    draft: number;
    archived: number;
    createdThisMonth: number;
    cuisines: number;
    cuisinesWithRecipes: number;
    languages: number;
    activeLanguages: number;
    languagesWithContent: number;
    apiKeys: number;
    apiKeysRevoked: number;
    apiKeysUsed: number;
  };
  recipesTrend: DashboardTrendPoint[];
  recipesByCuisine: DashboardSlice[];
  recipesByLanguage: DashboardSlice[];
  recipesByDifficulty: DashboardSlice[];
  recipesByStatus: DashboardSlice[];
  recentRecipes: DashboardRecentRecipe[];
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "var(--status-easy)",
  medium: "var(--status-medium)",
  hard: "var(--status-hard)",
};

const STATUS_COLORS: Record<string, string> = {
  published: "var(--status-active)",
  draft: "var(--bright-orange)",
  archived: "var(--status-inactive)",
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthLabel(date: Date) {
  return date.toLocaleString("en-US", { month: "short" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count: number, from: Date) {
  return Array.from({ length: count }, (_, index) => {
    const date = startOfMonth(from);
    date.setMonth(date.getMonth() - (count - 1 - index));
    return date;
  });
}

function toIso(value: Date | string | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return "";
}

function pickTitle(
  contents: Array<{ recipeId: mongoose.Types.ObjectId; langCode: string; title: string }>,
  recipeId: string,
  slug: string,
) {
  const rows = contents.filter((item) => item.recipeId.toString() === recipeId);
  return rows.find((item) => item.langCode === "en")?.title ?? rows[0]?.title ?? slug;
}

async function recipesCreatedByMonth(from: Date, to: Date) {
  const rows = await Recipe.aggregate<{ _id: string; value: number }>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        value: { $sum: 1 },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, row.value]));
}

async function buildTrend(): Promise<DashboardTrendPoint[]> {
  const now = new Date();
  const currentMonths = lastMonths(6, now);
  const currentStart = currentMonths[0];
  const nextMonth = startOfMonth(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const previousStart = startOfMonth(currentStart);
  previousStart.setMonth(previousStart.getMonth() - 6);

  const [currentMap, previousMap] = await Promise.all([
    recipesCreatedByMonth(currentStart, nextMonth),
    recipesCreatedByMonth(previousStart, currentStart),
  ]);

  return currentMonths.map((date) => {
    const previousDate = new Date(date);
    previousDate.setMonth(previousDate.getMonth() - 6);
    return {
      month: monthLabel(date),
      current: currentMap.get(monthKey(date)) ?? 0,
      previous: previousMap.get(monthKey(previousDate)) ?? 0,
    };
  });
}

export async function getDashboardData(adminId: string): Promise<DashboardData> {
  const monthStart = startOfMonth(new Date());

  const [
    recipes,
    published,
    draft,
    archived,
    createdThisMonth,
    cuisines,
    languages,
    activeLanguages,
    apiKeys,
    apiKeysRevoked,
    apiKeysUsed,
    cuisineDocs,
    languageDocs,
    recipesByCuisineRaw,
    recipesByDifficultyRaw,
    recipesByStatusRaw,
    languageCoverageRaw,
    recentRecipes,
    recipesTrend,
  ] = await Promise.all([
    Recipe.countDocuments(),
    Recipe.countDocuments({ status: "published" }),
    Recipe.countDocuments({ status: "draft" }),
    Recipe.countDocuments({ status: "archived" }),
    Recipe.countDocuments({ createdAt: { $gte: monthStart } }),
    Cuisine.countDocuments(),
    Language.countDocuments(),
    Language.countDocuments({ isActive: true }),
    ApiKey.countDocuments({ adminId, isActive: true }),
    ApiKey.countDocuments({ adminId, isActive: false }),
    ApiKey.countDocuments({ adminId, lastUsedAt: { $ne: null } }),
    Cuisine.find().select("name").lean(),
    Language.find().select("code name isActive").lean(),
    Recipe.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: "$cuisineId", count: { $sum: 1 } } },
    ]),
    Recipe.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]),
    Recipe.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    RecipeContent.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$langCode", count: { $sum: 1 } } },
    ]),
    Recipe.find()
      .sort({ updatedAt: -1 })
      .limit(6)
      .select("slug status difficulty cuisineId createdAt updatedAt")
      .lean(),
    buildTrend(),
  ]);

  const cuisineNameById = new Map(cuisineDocs.map((item) => [item._id.toString(), item.name]));
  const cuisineCountById = new Map(
    recipesByCuisineRaw.map((item) => [String(item._id), item.count]),
  );
  const recipesByCuisine = cuisineDocs
    .map((cuisine) => ({
      label: cuisine.name,
      value: cuisineCountById.get(cuisine._id.toString()) ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({
      ...item,
      emphasis: index === 0 && item.value > 0,
    }));
  const cuisinesWithRecipes = recipesByCuisine.filter((item) => item.value > 0).length;

  const languageCountByCode = new Map(
    languageCoverageRaw.map((item) => [item._id.toLowerCase(), item.count]),
  );
  const recipesByLanguage = languageDocs
    .map((language) => ({
      label: language.name,
      value: languageCountByCode.get(language.code.toLowerCase()) ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
  const languagesWithContent = recipesByLanguage.filter((item) => item.value > 0).length;

  const recipesByDifficulty = (["easy", "medium", "hard"] as const).map((level) => ({
    label: level,
    value: recipesByDifficultyRaw.find((item) => item._id === level)?.count ?? 0,
    color: DIFFICULTY_COLORS[level],
  }));

  const recipesByStatus = (["published", "draft", "archived"] as const).map((status) => ({
    label: status,
    value: recipesByStatusRaw.find((item) => item._id === status)?.count ?? 0,
    color: STATUS_COLORS[status],
  }));

  const recentContents = await RecipeContent.find({
    recipeId: { $in: recentRecipes.map((recipe) => recipe._id) },
  })
    .select("recipeId langCode title")
    .lean();

  return {
    stats: {
      recipes,
      published,
      draft,
      archived,
      createdThisMonth,
      cuisines,
      cuisinesWithRecipes,
      languages,
      activeLanguages,
      languagesWithContent,
      apiKeys,
      apiKeysRevoked,
      apiKeysUsed,
    },
    recipesTrend: recipes > 0 ? recipesTrend : [],
    recipesByCuisine: recipes > 0 ? recipesByCuisine : [],
    recipesByLanguage: recipes > 0 ? recipesByLanguage : [],
    recipesByDifficulty,
    recipesByStatus,
    recentRecipes: recentRecipes.map((recipe) => ({
      id: recipe._id.toString(),
      title: pickTitle(recentContents, recipe._id.toString(), recipe.slug),
      slug: recipe.slug,
      status: recipe.status,
      difficulty: recipe.difficulty ?? "easy",
      cuisine: cuisineNameById.get(recipe.cuisineId.toString()) ?? "Unknown",
      createdAt: toIso(recipe.createdAt),
      updatedAt: toIso(recipe.updatedAt),
    })),
  };
}
