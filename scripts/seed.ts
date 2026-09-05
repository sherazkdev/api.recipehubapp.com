import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { hashPassword, validatePassword } from "../src/features/auth/services/password.service";
import { Admin } from "../src/features/auth/models/admin.model";
import { CuisineContent } from "../src/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "../src/features/cuisines/models/cuisine.model";
import {
  backfillCuisineLanguageContent,
  saveLocalizedCuisineContent,
} from "../src/features/cuisines/services/cuisine-content.service";
import { Language } from "../src/features/languages/models/language.model";
import { Recipe } from "../src/features/recipes/models/recipe.model";
import { RecipeContent } from "../src/features/recipes/models/recipe-content.model";
import {
  backfillLanguageContent,
  saveLocalizedRecipeContent,
} from "../src/features/recipes/services/recipe-content.service";
// English is stored first. Other languages are filled from Language documents in the database.
import { connectDb } from "../src/shared/db/connect";
import { syncAllIndexes } from "../src/shared/db/indexes";
import { demoRecipes } from "./seed-data";

const cuisines = [
  { name: "Italian", slug: "italian", description: "Classic Italian cuisine" },
  { name: "Indian", slug: "indian", description: "Aromatic Indian dishes" },
  { name: "Chinese", slug: "chinese", description: "Traditional Chinese recipes" },
  { name: "Mexican", slug: "mexican", description: "Bold Mexican flavors" },
  { name: "Thai", slug: "thai", description: "Fresh Thai cooking" },
  { name: "Japanese", slug: "japanese", description: "Japanese home and restaurant classics" },
  { name: "Mediterranean", slug: "mediterranean", description: "Healthy Mediterranean meals" },
  { name: "Korean", slug: "korean", description: "Korean BBQ and comfort food" },
  { name: "French", slug: "french", description: "French culinary traditions" },
  { name: "American", slug: "american", description: "American comfort classics" },
  { name: "Middle Eastern", slug: "middle-eastern", description: "Middle Eastern favorites" },
  { name: "Vietnamese", slug: "vietnamese", description: "Vietnamese street and home food" },
];

const languages = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", isActive: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", isActive: true },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", isActive: true },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", isActive: true },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", isActive: true },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", isActive: true },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", isActive: true },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", isActive: true },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", isActive: true },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳", isActive: true },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", isActive: true },
];

async function upsertAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@recipehub.com").trim().toLowerCase();
  const username = (process.env.ADMIN_USERNAME ?? "admin").trim();
  const password = process.env.ADMIN_PASSWORD ?? "admin@123";
  const passwordHash = await hashPassword(password);

  const byUsername = await Admin.findOne({ username });
  const byEmail = await Admin.findOne({ email });
  const sameDoc =
    byUsername && byEmail && byUsername._id.toString() === byEmail._id.toString();

  if (byUsername && byEmail && !sameDoc) {
    byUsername.passwordHash = passwordHash;
    byUsername.tokenVersion = (byUsername.tokenVersion ?? 0) + 1;
    await byUsername.save();
    console.log(`Updated admin password for username "${username}" (${byUsername.email})`);
    console.warn(
      `Leftover admin already uses ${byEmail.email}; username "${username}" was not given that email`,
    );
  } else {
    const existing = byUsername ?? byEmail;
    if (existing) {
      existing.email = email;
      existing.username = username;
      existing.passwordHash = passwordHash;
      existing.tokenVersion = (existing.tokenVersion ?? 0) + 1;
      await existing.save();
      console.log(`Updated admin: ${email} / ${username}`);
    } else {
      await Admin.create({
        email,
        username,
        passwordHash,
        role: "admin",
      });
      console.log(`Created admin: ${email} / ${username}`);
    }
  }

  const policy = validatePassword(password);
  if (!policy.valid) {
    console.log(
      `Seeded password is accepted for login but does not meet change-password rules: ${policy.errors.join(", ")}`,
    );
  }

  const leftover = await Admin.find({
    $nor: [{ email }, { username }],
  })
    .select("email username")
    .lean();
  if (leftover.length) {
    console.log("Leftover admin users still in DB:");
    for (const row of leftover) {
      console.log(`  - ${row.email} / ${row.username}`);
    }
  }
}

async function seed() {
  await connectDb();
  await syncAllIndexes();
  await upsertAdmin();

  for (const cuisine of cuisines) {
    const doc = await Cuisine.findOneAndUpdate({ slug: cuisine.slug }, cuisine, {
      upsert: true,
      returnDocument: "after",
    });
    if (doc) {
      await CuisineContent.findOneAndUpdate(
        { cuisineId: doc._id, langCode: "en" },
        { name: cuisine.name, description: cuisine.description ?? "" },
        { upsert: true },
      );
    }
  }
  console.log(`Seeded ${cuisines.length} cuisines`);

  const backfillCodes: string[] = [];
  for (const [index, language] of languages.entries()) {
    const existing = await Language.findOne({ code: language.code });
    if (!existing) {
      await Language.create({
        ...language,
        isActive: true,
        sortOrder: index,
      });
      if (language.code !== "en") backfillCodes.push(language.code);
      continue;
    }

    const wasInactive = existing.isActive === false;
    existing.name = language.name;
    existing.nativeName = language.nativeName;
    existing.flag = language.flag;
    existing.isActive = true;
    await existing.save();
    if (wasInactive && language.code !== "en") backfillCodes.push(language.code);
  }
  console.log(`Seeded ${languages.length} languages (${backfillCodes.length} new or reactivated)`);
  console.log(`Seeding ${demoRecipes.length} recipes (English first, then every active language)`);

  for (const demo of demoRecipes) {
    const cuisine = await Cuisine.findOne({ slug: demo.cuisineSlug });
    if (!cuisine) {
      console.warn(`Skip ${demo.slug}: cuisine ${demo.cuisineSlug} missing`);
      continue;
    }
    let recipe = await Recipe.findOne({ slug: demo.slug });
    if (!recipe) {
      recipe = await Recipe.create({
        slug: demo.slug,
        cuisineId: cuisine._id,
        imagePath: "",
        prepTime: demo.prepTime,
        calories: demo.calories,
        difficulty: demo.difficulty,
        servings: demo.servings,
        nutrition: demo.nutrition,
        status: "published",
      });
    } else {
      recipe.cuisineId = cuisine._id;
      recipe.prepTime = demo.prepTime;
      recipe.calories = demo.calories;
      recipe.difficulty = demo.difficulty;
      recipe.servings = demo.servings;
      recipe.nutrition = demo.nutrition;
      recipe.status = "published";
      await recipe.save();
    }
    await RecipeContent.findOneAndUpdate(
      { recipeId: recipe._id, langCode: "en" },
      {
        title: demo.title,
        description: demo.description,
        tags: demo.tags,
        chefTips: demo.chefTips,
        ingredients: demo.ingredients,
        steps: demo.steps,
      },
      { upsert: true },
    );
    console.log(`Seeded recipe ${demo.slug}`);
  }

  try {
    const dbLanguages = await Language.find().select("code name isActive").sort({ code: 1 }).lean();
    const codes = [...new Set(dbLanguages.map((row) => row.code.toLowerCase()))].filter((code) => code !== "en");
    console.log(
      `Localizing from ${dbLanguages.length} language(s) saved in the database: ${dbLanguages
        .map((row) => `${row.code}${row.isActive === false ? " (inactive)" : ""}`)
        .join(", ")}`,
    );

    for (const code of backfillCodes.filter((item) => codes.includes(item))) {
      const recipes = await backfillLanguageContent(code);
      const cuisineResult = await backfillCuisineLanguageContent(code);
      console.log(
        `Backfilled ${code} for ${recipes.updated} existing English recipe(s) and ${cuisineResult.updated} cuisine(s)`,
      );
    }

    const recipeIds = new Set((await Recipe.find().select("_id").lean()).map((row) => row._id.toString()));
    const englishRecipes = (await RecipeContent.find({ langCode: "en" }).lean()).filter((row) =>
      recipeIds.has(row.recipeId.toString()),
    );

    let updated = 0;
    for (const english of englishRecipes) {
      const existing = await RecipeContent.find({ recipeId: english.recipeId }).select("langCode").lean();
      const have = new Set(existing.map((row) => row.langCode));
      const missing = codes.filter((code) => !have.has(code));
      if (missing.length === 0) {
        console.log(`Translations already present for recipe ${english.title}`);
        continue;
      }
      try {
        await saveLocalizedRecipeContent(
          english.recipeId,
          {
            title: english.title,
            description: english.description,
            tags: english.tags,
            chefTips: english.chefTips,
            ingredients: english.ingredients,
            steps: english.steps,
          },
          { wait: true },
        );
        updated += 1;
        console.log(`Translated recipe ${english.title} into ${missing.join(", ")}`);
      } catch (error) {
        console.error(`Failed to translate recipe ${english.title}:`, error);
      }
    }
    console.log(`Translated ${updated} recipes into every language saved in the database`);

    let cuisineUpdated = 0;
    const cuisineDocs = await Cuisine.find().select("_id name description").lean();
    for (const cuisine of cuisineDocs) {
      const existing = await CuisineContent.find({ cuisineId: cuisine._id }).select("langCode").lean();
      const have = new Set(existing.map((row) => row.langCode));
      const missing = codes.filter((code) => !have.has(code));
      if (missing.length === 0) {
        console.log(`Translations already present for cuisine ${cuisine.name}`);
        continue;
      }
      try {
        await saveLocalizedCuisineContent(
          cuisine._id,
          { name: cuisine.name, description: cuisine.description ?? "" },
          { wait: true },
        );
        cuisineUpdated += 1;
        console.log(`Translated cuisine ${cuisine.name} into ${missing.join(", ")}`);
      } catch (error) {
        console.error(`Failed to translate cuisine ${cuisine.name}:`, error);
      }
    }
    console.log(`Translated ${cuisineUpdated} cuisines into every language saved in the database`);
  } catch (error) {
    console.error("Translation backfill failed (admin seed and indexes still applied):", error);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
