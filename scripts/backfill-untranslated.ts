import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { CuisineContent } from "../src/features/cuisines/models/cuisine-content.model";
import { Cuisine } from "../src/features/cuisines/models/cuisine.model";
import { backfillUntranslatedCuisineContent } from "../src/features/cuisines/services/cuisine-content.service";
import { Language } from "../src/features/languages/models/language.model";
import { Recipe } from "../src/features/recipes/models/recipe.model";
import { RecipeContent } from "../src/features/recipes/models/recipe-content.model";
import { backfillUntranslatedRecipeContent } from "../src/features/recipes/services/recipe-content.service";
import { connectDb } from "../src/shared/db/connect";

async function report() {
  const langs = await Language.find({ isActive: true }).select("code").lean();
  const codes = langs.map((item) => item.code).sort();
  const recipes = await Recipe.find().select("slug").lean();
  const rows: string[] = [];
  let missing = 0;
  let same = 0;

  for (const recipe of recipes) {
    const contents = await RecipeContent.find({ recipeId: recipe._id }).select("langCode title").lean();
    const en = contents.find((item) => item.langCode === "en")?.title ?? "";
    for (const code of codes) {
      const row = contents.find((item) => item.langCode === code);
      if (!row) {
        missing += 1;
        rows.push(`${recipe.slug} ${code} MISSING`);
        continue;
      }
      if (code !== "en" && row.title.trim().toLowerCase() === en.trim().toLowerCase()) {
        same += 1;
        rows.push(`${recipe.slug} ${code} SAME "${row.title}"`);
      } else {
        rows.push(`${recipe.slug} ${code} OK "${row.title}"`);
      }
    }
  }

  const cuisineDocs = await Cuisine.find().select("slug name").lean();
  let cuisineMissing = 0;
  let cuisineSame = 0;
  for (const cuisine of cuisineDocs) {
    const contents = await CuisineContent.find({ cuisineId: cuisine._id }).select("langCode name").lean();
    const en = contents.find((item) => item.langCode === "en")?.name ?? "";
    for (const code of codes) {
      const row = contents.find((item) => item.langCode === code);
      if (!row) {
        cuisineMissing += 1;
        rows.push(`cuisine:${cuisine.slug} ${code} MISSING`);
        continue;
      }
      if (code !== "en" && row.name.trim().toLowerCase() === en.trim().toLowerCase()) {
        cuisineSame += 1;
        rows.push(`cuisine:${cuisine.slug} ${code} SAME "${row.name}"`);
      } else {
        rows.push(`cuisine:${cuisine.slug} ${code} OK "${row.name}"`);
      }
    }
  }

  console.log(rows.join("\n"));
  return {
    missing,
    same,
    cuisineMissing,
    cuisineSame,
    recipes: recipes.length,
    cuisines: cuisineDocs.length,
    langs: codes.length,
  };
}

async function main() {
  await connectDb();
  console.log("--- before ---");
  const before = await report();
  console.log(
    `recipes missing=${before.missing} same=${before.same}; cuisines missing=${before.cuisineMissing} same=${before.cuisineSame}`,
  );

  if (before.missing || before.same) {
    const result = await backfillUntranslatedRecipeContent();
    console.log(`retried ${result.updated} recipe language rows`);
  }
  if (before.cuisineMissing || before.cuisineSame) {
    const result = await backfillUntranslatedCuisineContent();
    console.log(`retried ${result.updated} cuisine language rows`);
  }

  console.log("--- after ---");
  const after = await report();
  console.log(
    `recipes missing=${after.missing} same=${after.same}; cuisines missing=${after.cuisineMissing} same=${after.cuisineSame}`,
  );
  if (after.missing || after.cuisineMissing) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
