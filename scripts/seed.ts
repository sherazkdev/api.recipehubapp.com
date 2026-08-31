import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { hashPassword, validatePassword } from "../src/features/auth/services/password.service";
import { Admin } from "../src/features/auth/models/admin.model";
import { Cuisine } from "../src/features/cuisines/models/cuisine.model";
import { Language } from "../src/features/languages/models/language.model";
import { Recipe } from "../src/features/recipes/models/recipe.model";
import { RecipeContent } from "../src/features/recipes/models/recipe-content.model";
import {
  backfillLanguageContent,
  saveLocalizedRecipeContent,
} from "../src/features/recipes/services/recipe-content.service";
import { getActiveLanguageCodes } from "../src/features/i18n/translate.service";
// English is stored first. Other languages are filled by bing-translate-api.
import { connectDb } from "../src/shared/db/connect";
import { syncAllIndexes } from "../src/shared/db/indexes";

type DemoRecipe = {
  slug: string;
  cuisineSlug: string;
  prepTime: number;
  calories: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  title: string;
  description: string;
  tags: string[];
  chefTips: string[];
  ingredients: Array<{ name: string; amount: string; unit: string }>;
  steps: Array<{ order: number; title: string; text: string }>;
};

const demoRecipes: DemoRecipe[] = [
  {
    slug: "garlic-bread",
    cuisineSlug: "italian",
    prepTime: 20,
    calories: 280,
    difficulty: "easy",
    servings: 4,
    title: "Garlic Bread",
    description: "Crispy baked bread with garlic butter and herbs.",
    tags: ["bread", "side", "italian"],
    chefTips: ["Serve hot from the oven."],
    ingredients: [
      { name: "Bread", amount: "1", unit: "loaf" },
      { name: "Garlic", amount: "4", unit: "cloves" },
      { name: "Butter", amount: "50", unit: "g" },
    ],
    steps: [
      { order: 1, title: "Prepare", text: "Mix soft butter with chopped garlic." },
      { order: 2, title: "Bake", text: "Spread on bread and bake until golden." },
    ],
  },
  {
    slug: "spicy-chicken-curry",
    cuisineSlug: "indian",
    prepTime: 45,
    calories: 420,
    difficulty: "medium",
    servings: 4,
    title: "Spicy Chicken Curry",
    description: "A warm Indian curry with tender chicken and aromatic spices.",
    tags: ["chicken", "curry", "dinner"],
    chefTips: ["Rest the curry for ten minutes before serving."],
    ingredients: [
      { name: "Chicken", amount: "500", unit: "g" },
      { name: "Onion", amount: "2", unit: "pcs" },
      { name: "Tomato", amount: "2", unit: "pcs" },
    ],
    steps: [
      { order: 1, title: "Cook the base", text: "Fry onion until golden, then add spices and tomato." },
      { order: 2, title: "Simmer", text: "Add chicken and simmer until cooked through." },
    ],
  },
];

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
    await Cuisine.updateOne({ slug: cuisine.slug }, cuisine, { upsert: true });
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
        status: "published",
      });
    } else {
      recipe.cuisineId = cuisine._id;
      recipe.prepTime = demo.prepTime;
      recipe.calories = demo.calories;
      recipe.difficulty = demo.difficulty;
      recipe.servings = demo.servings;
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
    for (const code of backfillCodes) {
      const result = await backfillLanguageContent(code);
      console.log(`Backfilled ${code} for ${result.updated} existing English recipe(s)`);
    }

    const codes = (await getActiveLanguageCodes()).filter((code) => code !== "en");
    let updated = 0;
    for (const demo of demoRecipes) {
      const recipe = await Recipe.findOne({ slug: demo.slug }).select("_id").lean();
      if (!recipe) continue;
      const existing = await RecipeContent.find({ recipeId: recipe._id }).select("langCode").lean();
      const have = new Set(existing.map((row) => row.langCode));
      const missing = codes.filter((code) => !have.has(code));
      if (missing.length === 0) {
        console.log(`Translations already present for ${demo.slug}`);
        continue;
      }
      await saveLocalizedRecipeContent(
        recipe._id,
        {
          title: demo.title,
          description: demo.description,
          tags: demo.tags,
          chefTips: demo.chefTips,
          ingredients: demo.ingredients,
          steps: demo.steps,
        },
        { wait: true },
      );
      updated += 1;
      console.log(`Translated ${demo.slug} into ${missing.length} missing language(s)`);
    }
    console.log(`Translated ${updated} demo recipes into every active language`);
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
