import mongoose from "mongoose";
import { after } from "next/server";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import {
  getActiveLanguageCodes,
  isTranslatableUnit,
  translateMany,
  translateText,
} from "@/features/i18n/translate.service";
import { invalidateRecipeCaches } from "@/shared/cache/invalidate";
import { mapLimit } from "@/shared/utils/async";

export type RecipeIngredientInput = {
  name: string;
  amount?: string;
  unit?: string;
};

export type RecipeStepInput = {
  order: number;
  title?: string;
  durationMin?: number;
  text: string;
  imagePath?: string;
};

export type RecipeContentFields = {
  title: string;
  description: string;
  tags: string[];
  chefTips: string[];
  ingredients: RecipeIngredientInput[];
  steps: RecipeStepInput[];
};

export function normalizeEnglishContent(
  input: Partial<RecipeContentFields> & { title: string },
): RecipeContentFields {
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    chefTips: (input.chefTips ?? []).map((tip) => tip.trim()).filter(Boolean),
    ingredients: (input.ingredients ?? [])
      .filter((item) => item.name?.trim())
      .map((item) => ({
        name: item.name.trim(),
        amount: item.amount?.trim() ?? "",
        unit: item.unit?.trim() ?? "",
      })),
    steps: (input.steps ?? [])
      .filter((item) => item.text?.trim())
      .map((item, index) => ({
        order: item.order ?? index + 1,
        title: item.title?.trim() ?? "",
        durationMin: item.durationMin ?? 0,
        text: item.text.trim(),
        imagePath: item.imagePath ?? "",
      })),
  };
}

async function upsertContent(
  recipeId: mongoose.Types.ObjectId,
  langCode: string,
  content: RecipeContentFields,
) {
  await RecipeContent.findOneAndUpdate(
    { recipeId, langCode },
    content,
    { upsert: true, returnDocument: "after" },
  );
}

async function translateTitle(title: string, targetLang: string) {
  const first = (await translateText(title, targetLang)).trim();
  if (first && first.toLowerCase() !== title.trim().toLowerCase()) return first;
  const second = (await translateText(title, targetLang)).trim();
  return second || first || title;
}

async function translateContent(english: RecipeContentFields, targetLang: string) {
  const title = await translateTitle(english.title, targetLang);
  const strings: string[] = [
    english.description,
    ...english.tags,
    ...english.chefTips,
    ...english.ingredients.map((item) => item.name),
    ...english.ingredients.map((item) => (isTranslatableUnit(item.unit ?? "") ? item.unit ?? "" : "")),
    ...english.steps.map((item) => item.title ?? ""),
    ...english.steps.map((item) => item.text),
  ];

  const translated = await translateMany(strings, targetLang);
  let cursor = 0;
  const next = () => {
    const value = translated[cursor] ?? "";
    cursor += 1;
    return value;
  };

  const description = next();
  const tags = english.tags.map(() => next()).filter(Boolean);
  const chefTips = english.chefTips.map(() => next()).filter(Boolean);
  const ingredientNames = english.ingredients.map(() => next());
  const ingredientUnits = english.ingredients.map((item) => {
    const translatedUnit = next();
    return isTranslatableUnit(item.unit ?? "") ? translatedUnit : (item.unit ?? "");
  });
  const stepTitles = english.steps.map(() => next());
  const stepTexts = english.steps.map(() => next());

  return {
    title,
    description,
    tags,
    chefTips,
    ingredients: english.ingredients.map((item, index) => ({
      name: ingredientNames[index] || item.name,
      amount: item.amount ?? "",
      unit: ingredientUnits[index] || item.unit || "",
    })),
    steps: english.steps.map((item, index) => ({
      order: item.order,
      title: stepTitles[index] || item.title || "",
      durationMin: item.durationMin ?? 0,
      text: stepTexts[index] || item.text,
      imagePath: item.imagePath ?? "",
    })),
  } satisfies RecipeContentFields;
}

function scheduleBackground(task: () => Promise<void>) {
  const run = () => task().catch((error) => console.error("Background translate:", error));
  try {
    after(run);
  } catch {
    void run();
  }
}

async function translateRemainingLanguages(recipeId: mongoose.Types.ObjectId, english: RecipeContentFields) {
  const languages = (await getActiveLanguageCodes()).filter((code) => code !== "en");
  await mapLimit(languages, 6, async (langCode) => {
    const localized = await translateContent(english, langCode);
    await upsertContent(recipeId, langCode, localized);
  });
  invalidateRecipeCaches();
}

export async function saveLocalizedRecipeContent(
  recipeId: mongoose.Types.ObjectId,
  input: Partial<RecipeContentFields> & { title: string },
  options?: { wait?: boolean },
) {
  const english = normalizeEnglishContent(input);
  await upsertContent(recipeId, "en", english);
  invalidateRecipeCaches();

  if (options?.wait) {
    await translateRemainingLanguages(recipeId, english);
    return;
  }

  scheduleBackground(() => translateRemainingLanguages(recipeId, english));
}

export async function backfillLanguageContent(langCode: string) {
  const code = langCode.toLowerCase();
  if (code === "en") return { updated: 0 };

  const englishDocs = await RecipeContent.find({ langCode: "en" }).lean();
  await mapLimit(englishDocs, 3, async (doc) => {
    const localized = await translateContent(
      normalizeEnglishContent({
        title: doc.title,
        description: doc.description,
        tags: doc.tags,
        chefTips: doc.chefTips,
        ingredients: doc.ingredients,
        steps: doc.steps,
      }),
      code,
    );
    await upsertContent(doc.recipeId, code, localized);
  });
  invalidateRecipeCaches();
  return { updated: englishDocs.length };
}

export async function backfillAllRecipeTranslations() {
  const englishDocs = await RecipeContent.find({ langCode: "en" }).lean();
  await mapLimit(englishDocs, 1, async (doc) => {
    await saveLocalizedRecipeContent(
      doc.recipeId,
      {
        title: doc.title,
        description: doc.description,
        tags: doc.tags,
        chefTips: doc.chefTips,
        ingredients: doc.ingredients,
        steps: doc.steps,
      },
      { wait: true },
    );
  });
  return { updated: englishDocs.length };
}

export async function backfillUntranslatedRecipeContent() {
  const englishDocs = await RecipeContent.find({ langCode: "en" }).lean();
  const languages = (await getActiveLanguageCodes()).filter((code) => code !== "en");
  let updated = 0;

  for (const doc of englishDocs) {
    const english = normalizeEnglishContent({
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
      chefTips: doc.chefTips,
      ingredients: doc.ingredients,
      steps: doc.steps,
    });

    for (const langCode of languages) {
      const existing = await RecipeContent.findOne({ recipeId: doc.recipeId, langCode }).lean();
      const sameTitle =
        !existing || existing.title.trim().toLowerCase() === english.title.trim().toLowerCase();
      if (!sameTitle) continue;

      const localized = await translateContent(english, langCode);
      await upsertContent(doc.recipeId, langCode, localized);
      updated += 1;
    }
  }

  invalidateRecipeCaches();
  return { updated };
}

export async function deleteLanguageContent(langCode: string) {
  const code = langCode.toLowerCase();
  if (code === "en") return { deleted: 0 };
  const result = await RecipeContent.deleteMany({ langCode: code });
  return { deleted: result.deletedCount ?? 0 };
}
