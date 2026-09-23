import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(".env.local") });
config({ path: path.resolve(".env") });

const prompt =
  "Generate a detailed recipe for Chicken Biryani, Hyderabadi style. cuisine: Indian; difficulty: medium; meal type: dinner.";

const started = Date.now();
const { getSettingsInternal } = await import("../src/features/settings/services/settings.service.ts");
const { generateRecipe } = await import("../src/features/ai/services/groq.service.ts");
const { connectDb } = await import("../src/shared/db/connect.ts");

await connectDb();
const settings = await getSettingsInternal();

const recipe = await generateRecipe({
  prompt,
  language: "English",
  ai: settings.ai,
});

console.log(
  JSON.stringify(
    {
      ms: Date.now() - started,
      title: recipe.title,
      cook_time: recipe.cook_time,
      calories: recipe.calories,
      ingredient_count: recipe.ingredients?.length,
      steps_count: recipe.steps?.length,
      image: recipe.image,
      image_model: recipe.image_model,
      image_width: recipe.image_width,
      image_height: recipe.image_height,
      image_quality: recipe.image_quality,
      recipeMetaPath: recipe.recipeMetaPath,
      watermark: recipe.image_quality?.watermark,
    },
    null,
    2,
  ),
);
