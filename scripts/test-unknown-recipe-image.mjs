import { config } from "dotenv";
import { resolve } from "path";
import { readFile } from "fs/promises";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const { DEFAULT_AI } = await import("../src/features/settings/types.ts");
const { resolveRecipeHeroImage } = await import("../src/features/ai/services/recipe-hero-image.service.ts");
const { buildRecipeImagePrompt } = await import("../src/features/ai/services/recipe-image-prompt.service.ts");

const recipes = [
  {
    name: "lentil-stew",
    recipe: {
      title: "Smoky Red Lentil Stew",
      ingredients: ["red lentils", "smoked paprika", "charred corn", "fresh cilantro", "lime wedge", "salt", "olive oil"],
      tags: ["stew", "vegetarian"],
      steps: ["Simmer red lentils until thick and tender.", "Stir in paprika and corn.", "Serve with cilantro and lime."],
    },
  },
  {
    name: "fried-rice",
    recipe: {
      title: "Vegetable Fried Rice",
      ingredients: ["jasmine rice", "peas", "carrots", "eggs", "soy sauce", "vegetable oil"],
      tags: ["rice", "chinese"],
      steps: ["Stir-fry rice with vegetables over high heat."],
    },
  },
  {
    name: "grilled-steak",
    recipe: {
      title: "Grilled Ribeye Steak",
      ingredients: ["ribeye steak", "rosemary", "butter", "salt", "black pepper"],
      tags: ["grilled", "american"],
      steps: ["Grill steak to medium-rare and rest before slicing."],
    },
  },
];

for (const item of recipes) {
  const prompt = await buildRecipeImagePrompt(item.recipe, "English");
  console.log("\n===", item.name, "===");
  console.log("PROMPT:", prompt);
  const started = Date.now();
  const result = await resolveRecipeHeroImage({
    recipe: item.recipe,
    ai: { ...DEFAULT_AI, imageSource: "pollinations" },
  });
  console.log("TIME_MS:", Date.now() - started, "provider_ms:", result.generationMs);
  console.log("URL:", result.url);
  console.log("MODEL:", result.model, "SEED:", result.seed);
  console.log("DIM:", result.imageWidth, "x", result.imageHeight, "bytes:", result.providerBytes);
  console.log("PROVIDER_DEBUG:", result.providerDebugPath);

  if (result.url.startsWith("/uploads/")) {
    const served = resolve(process.cwd(), result.url.replace(/^\//, "").replace(/\//g, "\\"));
    const provider = result.providerDebugPath
      ? resolve(process.cwd(), result.providerDebugPath.replace(/^\//, "").replace(/\//g, "\\"))
      : null;
    if (provider) {
      const [a, b] = await Promise.all([readFile(served), readFile(provider)]);
      console.log("SERVED_EQUALS_PROVIDER:", a.equals(b), "served", a.length, "provider", b.length);
    }
  }
}
