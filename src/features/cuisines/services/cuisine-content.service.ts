import mongoose from "mongoose";
import { after } from "next/server";
import { CuisineContent } from "@/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { getActiveLanguageCodes, translateMany, translateText } from "@/features/i18n/translate.service";
import { invalidateCatalogCaches } from "@/shared/cache/invalidate";
import { mapLimit } from "@/shared/utils/async";

export type CuisineContentFields = {
  name: string;
  description: string;
};

export function normalizeEnglishContent(
  input: Partial<CuisineContentFields> & { name: string },
): CuisineContentFields {
  return {
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
  };
}

async function upsertContent(
  cuisineId: mongoose.Types.ObjectId,
  langCode: string,
  content: CuisineContentFields,
) {
  await CuisineContent.findOneAndUpdate(
    { cuisineId, langCode },
    content,
    { upsert: true, returnDocument: "after" },
  );
}

async function translateName(name: string, targetLang: string) {
  const first = (await translateText(name, targetLang)).trim();
  if (first && first.toLowerCase() !== name.trim().toLowerCase()) return first;
  const second = (await translateText(name, targetLang)).trim();
  return second || first || name;
}

async function translateContent(english: CuisineContentFields, targetLang: string) {
  const name = await translateName(english.name, targetLang);
  const [description] = await translateMany([english.description], targetLang);
  return { name, description } satisfies CuisineContentFields;
}

function scheduleBackground(task: () => Promise<void>) {
  const run = () => task().catch((error) => console.error("Background translate:", error));
  try {
    after(run);
  } catch {
    void run();
  }
}

async function translateRemainingLanguages(cuisineId: mongoose.Types.ObjectId, english: CuisineContentFields) {
  const languages = (await getActiveLanguageCodes()).filter((code) => code !== "en");
  await mapLimit(languages, 6, async (langCode) => {
    const localized = await translateContent(english, langCode);
    await upsertContent(cuisineId, langCode, localized);
  });
  invalidateCatalogCaches();
}

export async function ensureEnglishCuisineContents() {
  const cuisines = await Cuisine.find().select("_id name description").lean();
  const existing = await CuisineContent.find({
    cuisineId: { $in: cuisines.map((item) => item._id) },
    langCode: "en",
  })
    .select("cuisineId")
    .lean();
  const have = new Set(existing.map((item) => item.cuisineId.toString()));
  let updated = 0;

  for (const cuisine of cuisines) {
    if (have.has(cuisine._id.toString())) continue;
    await upsertContent(
      cuisine._id,
      "en",
      normalizeEnglishContent({
        name: cuisine.name,
        description: cuisine.description,
      }),
    );
    updated += 1;
  }

  if (updated) invalidateCatalogCaches();
  return { updated };
}

export async function saveLocalizedCuisineContent(
  cuisineId: mongoose.Types.ObjectId,
  input: Partial<CuisineContentFields> & { name: string },
  options?: { wait?: boolean },
) {
  const english = normalizeEnglishContent(input);
  await upsertContent(cuisineId, "en", english);
  invalidateCatalogCaches();

  if (options?.wait) {
    await translateRemainingLanguages(cuisineId, english);
    return;
  }

  scheduleBackground(() => translateRemainingLanguages(cuisineId, english));
}

export async function backfillCuisineLanguageContent(langCode: string) {
  const code = langCode.toLowerCase();
  if (code === "en") return { updated: 0 };

  await ensureEnglishCuisineContents();
  const englishDocs = await CuisineContent.find({ langCode: "en" }).lean();
  await mapLimit(englishDocs, 3, async (doc) => {
    const localized = await translateContent(
      normalizeEnglishContent({
        name: doc.name,
        description: doc.description,
      }),
      code,
    );
    await upsertContent(doc.cuisineId, code, localized);
  });
  invalidateCatalogCaches();
  return { updated: englishDocs.length };
}

export async function backfillUntranslatedCuisineContent() {
  await ensureEnglishCuisineContents();
  const englishDocs = await CuisineContent.find({ langCode: "en" }).lean();
  const languages = (await getActiveLanguageCodes()).filter((code) => code !== "en");
  let updated = 0;

  for (const doc of englishDocs) {
    const english = normalizeEnglishContent({
      name: doc.name,
      description: doc.description,
    });

    for (const langCode of languages) {
      const existing = await CuisineContent.findOne({ cuisineId: doc.cuisineId, langCode }).lean();
      const sameName =
        !existing || existing.name.trim().toLowerCase() === english.name.trim().toLowerCase();
      if (!sameName) continue;

      const localized = await translateContent(english, langCode);
      await upsertContent(doc.cuisineId, langCode, localized);
      updated += 1;
    }
  }

  invalidateCatalogCaches();
  return { updated };
}

export async function deleteCuisineLanguageContent(langCode: string) {
  const code = langCode.toLowerCase();
  if (code === "en") return { deleted: 0 };
  const result = await CuisineContent.deleteMany({ langCode: code });
  return { deleted: result.deletedCount ?? 0 };
}
