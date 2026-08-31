import { apiGet } from "@/lib/api-client";

export type DashboardSlice = {
  label: string;
  value: number;
  color?: string;
  emphasis?: boolean;
};

export type DashboardApiData = {
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
  recipesTrend: Array<{ month: string; current: number; previous: number }>;
  recipesByCuisine: DashboardSlice[];
  recipesByLanguage: DashboardSlice[];
  recipesByDifficulty: DashboardSlice[];
  recipesByStatus: DashboardSlice[];
  recentRecipes: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    difficulty: string;
    cuisine: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

export async function fetchDashboard(): Promise<DashboardApiData> {
  return apiGet<DashboardApiData>("/api/admin/dashboard");
}

export function formatStatValue(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
