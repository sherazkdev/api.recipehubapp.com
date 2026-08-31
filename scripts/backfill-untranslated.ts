import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

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

  console.log(rows.join("\n"));
  return { missing, same, recipes: recipes.length, langs: codes.length };
}

async function main() {
  await connectDb();
  console.log("--- before ---");
  const before = await report();
  console.log(`missing=${before.missing} same=${before.same}`);

  if (before.missing || before.same) {
    const result = await backfillUntranslatedRecipeContent();
    console.log(`retried ${result.updated} language rows`);
  }

  console.log("--- after ---");
  const after = await report();
  console.log(`missing=${after.missing} same=${after.same}`);
  if (after.missing) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
