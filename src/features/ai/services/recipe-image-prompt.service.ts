import {
  buildRecipeImagePromptFromContext,
  type RecipeImagePromptContext,
} from "@/features/ai/utils/recipe-image-prompt-builder";
import {
  detectScriptSourceLanguage,
  recipeNeedsEnglishImagePrompt,
  resolveRecipeContentLanguageCode,
} from "@/features/ai/utils/recipe-image-language";
import { translateMany, translateText } from "@/features/i18n/translate.service";
import type { RecipeImagePromptDebug } from "@/features/ai/services/recipe-image-debug.service";

function contextFromRecipe(recipe: Record<string, unknown>): RecipeImagePromptContext {
  const title = String(recipe.title ?? "").trim();
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((item) => String(item))
    : [];
  const tags = Array.isArray(recipe.tags) ? recipe.tags.map((item) => String(item)) : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps.map((item) => String(item)) : [];
  return { title, ingredients, tags, steps };
}

export type PreparedRecipeImagePrompt = {
  imagePrompt: string;
  debug: RecipeImagePromptDebug;
};

async function englishContextForImage(
  context: RecipeImagePromptContext,
  recipeLanguageInput: string,
  contentLanguageCode: string,
): Promise<{ context: RecipeImagePromptContext; debug: RecipeImagePromptDebug }> {
  const blob = [context.title ?? "", ...(context.ingredients ?? []), ...(context.tags ?? [])].join(" ");
  const baseDebug: RecipeImagePromptDebug = {
    recipeLanguageInput,
    contentLanguageCode,
    translateFrom: contentLanguageCode,
    translatedToEnglish: false,
    titleBefore: context.title ?? "",
    titleAfter: context.title ?? "",
    ingredientsSampleBefore: (context.ingredients ?? []).slice(0, 5),
    ingredientsSampleAfter: (context.ingredients ?? []).slice(0, 5),
  };

  if (!recipeNeedsEnglishImagePrompt(contentLanguageCode, blob)) {
    return { context, debug: baseDebug };
  }

  let fromLang = contentLanguageCode;
  if (fromLang === "en" || fromLang.startsWith("en")) {
    fromLang = detectScriptSourceLanguage(blob);
  }

  try {
    const title = context.title?.trim() ?? "";
    const ingredients = context.ingredients ?? [];
    const tags = context.tags ?? [];

    const [enTitle, ...enIngredients] = await translateMany([title, ...ingredients], "en", fromLang);
    const enTags = tags.length ? await translateMany(tags, "en", fromLang) : [];

    const normalizedTitle = (enTitle || title).trim();
    const normalizedIngredients = enIngredients
      .map((item, index) => item.trim() || ingredients[index] || "")
      .filter(Boolean);
    const normalizedTags = enTags.map((item, index) => item.trim() || tags[index] || "").filter(Boolean);

    return {
      context: {
        title: normalizedTitle,
        ingredients: normalizedIngredients.length ? normalizedIngredients : ingredients,
        tags: normalizedTags.length ? normalizedTags : tags,
        steps: context.steps,
      },
      debug: {
        ...baseDebug,
        translateFrom: fromLang,
        translatedToEnglish: true,
        titleAfter: normalizedTitle,
        ingredientsSampleAfter: (normalizedIngredients.length ? normalizedIngredients : ingredients).slice(0, 5),
      },
    };
  } catch {
    try {
      const enTitle = await translateText(context.title ?? "", "en", fromLang);
      return {
        context: { ...context, title: enTitle.trim() || context.title },
        debug: {
          ...baseDebug,
          translateFrom: fromLang,
          translatedToEnglish: true,
          titleAfter: enTitle.trim() || context.title || "",
        },
      };
    } catch {
      return { context, debug: baseDebug };
    }
  }
}

export async function prepareRecipeImagePrompt(
  recipe: Record<string, unknown>,
  recipeLanguage = "English",
): Promise<PreparedRecipeImagePrompt> {
  const raw = contextFromRecipe(recipe);
  const contentLanguageCode = await resolveRecipeContentLanguageCode(recipeLanguage);
  const { context, debug } = await englishContextForImage(raw, recipeLanguage, contentLanguageCode);
  const imagePrompt = buildRecipeImagePromptFromContext(context);
  return { imagePrompt, debug };
}

/** Build Pollinations prompt in English from recipe JSON (any dashboard language → English for images). */
export async function buildRecipeImagePrompt(recipe: Record<string, unknown>, recipeLanguage = "English") {
  const prepared = await prepareRecipeImagePrompt(recipe, recipeLanguage);
  return prepared.imagePrompt;
}
