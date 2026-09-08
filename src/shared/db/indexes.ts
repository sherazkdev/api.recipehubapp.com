import { Admin } from "@/features/auth/models/admin.model";
import { CuisineContent } from "@/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { Language } from "@/features/languages/models/language.model";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { AiActivity } from "@/features/ai-activity/models/ai-activity.model";
import { Settings } from "@/features/settings/models/settings.model";
import { ApiKey } from "@/features/tokens/models/token.model";

const MODELS = [Admin, Cuisine, CuisineContent, Language, Recipe, RecipeContent, ApiKey, Settings, AiActivity] as const;

export type IndexSyncResult = {
  collection: string;
  indexes: string[];
};

export async function syncAllIndexes(): Promise<IndexSyncResult[]> {
  const results: IndexSyncResult[] = [];

  for (const model of MODELS) {
    await model.syncIndexes();
    const specs = await model.collection.indexes();
    const indexes = specs
      .map((spec) => spec.name)
      .filter((name): name is string => Boolean(name));
    results.push({ collection: model.collection.collectionName, indexes });
    console.log(`[indexes] ${model.collection.collectionName}: ${indexes.join(", ")}`);
  }

  return results;
}
