import type { AiSettings } from "@/features/settings/types";
import { groqChat, type GroqMessage } from "@/features/ai/services/groq-api";
import { resolveRecipeHeroImage } from "@/features/ai/services/recipe-hero-image.service";

export { groqChat, type GroqMessage };

function buildRecipeInstruction(ai: AiSettings, language: string, prompt: string) {
  const foodRule = ai.foodOnlyMode
    ? "You must NEVER answer anything that is not a real food or drink recipe request. If unrelated, reply with {}. "
    : "";

  const nutritionRule = ai.includeNutrition
    ? "nutrition MUST be included with numeric calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, cholesterol_mg (all > 0). "
    : "Do not include a nutrition field. ";

  return (
    "You are a recipe generator. Reply with ONLY one valid JSON object. No markdown, no extra text. " +
    foodRule +
    "Keys: title (string), cook_time (string minutes number), calories (number per serving), " +
    `ingredients (string[]), steps (string[] with ${ai.minSteps}-${ai.maxSteps} steps), tags (string[]), chef_tips (string[]), ` +
    nutritionRule +
    `Respond in ${language}. Generate for: ${prompt}`
  );
}

function buildScanInstruction(ai: AiSettings, language: string, foodOnlyMessage: string) {
  const strictRule = ai.foodOnlyMode
    ? "If the image is not clearly food, drink, groceries, ingredients, a fridge with food, or a cooked dish, reply with is_food false. "
    : "";

  return (
    "You are a food image checker for a recipe app. Reply with ONLY one valid JSON object. " +
    strictRule +
    `If not food, reply {"is_food":false,"message":"${foodOnlyMessage}"}. ` +
    'If food, reply {"is_food":true,"ingredients":["name",...],"dish_name":"optional"}. ' +
    `Respond in ${language}.`
  );
}

export async function testGroqConnection(apiKey: string, model: string) {
  const started = Date.now();
  await groqChat({
    apiKey,
    model,
    temperature: 0,
    messages: [
      { role: "system", content: 'Reply with JSON: {"ok":true}' },
      { role: "user", content: "ping" },
    ],
  });
  return { ok: true, latencyMs: Date.now() - started };
}

export async function generateRecipe(input: { prompt: string; language: string; ai: AiSettings }) {
  if (!input.ai.groqApiKey.trim()) {
    throw new Error("Groq API key is not configured");
  }

  const instruction = buildRecipeInstruction(input.ai, input.language, input.prompt);

  const recipe = await groqChat({
    apiKey: input.ai.groqApiKey,
    model: input.ai.recipeModel,
    temperature: 0.7,
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: `Create the recipe as a single JSON object for: ${input.prompt}` },
    ],
  });

  if (recipe && Object.keys(recipe).length > 0 && input.ai.imageSource === "pollinations") {
    const imageResult = await resolveRecipeHeroImage({
      recipe,
      ai: input.ai,
      recipeLanguage: input.language,
    });
    recipe.image = imageResult.url;
    recipe.image_prompt = imageResult.imagePrompt;
    if (imageResult.seed != null) recipe.image_seed = imageResult.seed;
    if (imageResult.model) recipe.image_model = imageResult.model;
    if (imageResult.generationMs != null) recipe.image_generation_ms = imageResult.generationMs;
    if (imageResult.imageWidth != null) recipe.image_width = imageResult.imageWidth;
    if (imageResult.imageHeight != null) recipe.image_height = imageResult.imageHeight;
    if (imageResult.providerBytes != null) recipe.image_bytes = imageResult.providerBytes;
    if (imageResult.recipeMetaPath) recipe.recipe_image_meta = imageResult.recipeMetaPath;
    recipe.image_debug = {
      prompt: imageResult.imagePrompt,
      prompt_meta: imageResult.promptDebug ?? null,
      attempts: imageResult.attempts ?? [],
      generation_error: imageResult.error ?? null,
      debug_log_path: imageResult.debugLogPath ?? null,
    };
    recipe.image_quality = {
      meets_hero_requirements:
        imageResult.model === "catalog" || imageResult.model === "useful-folder",
      blur_source:
        imageResult.providerBytes != null
          ? "provider"
          : imageResult.model === "catalog" || imageResult.model === "useful-folder"
            ? "n/a"
            : "unknown",
      provider: imageResult.model === "catalog" || imageResult.model === "useful-folder" ? null : "pollinations.ai",
      model: imageResult.model ?? "unknown",
      dimensions:
        imageResult.imageWidth && imageResult.imageHeight
          ? `${imageResult.imageWidth}x${imageResult.imageHeight}`
          : null,
      watermark:
        imageResult.model === "catalog" || imageResult.model === "useful-folder"
          ? null
          : "Recipe API requests nologo=true; served copy crops bottom watermark strip. Full removal without crop needs free Pollinations account token (POLLINATIONS_TOKEN) per provider docs.",
      note:
        imageResult.model === "catalog" || imageResult.model === "useful-folder"
          ? null
          : "768px provider cap; merged/soft food texture — current free Pollinations setup does not meet hero quality.",
    };
  }

  if (!input.ai.includeNutrition && recipe && typeof recipe === "object") {
    delete recipe.nutrition;
  }

  return recipe;
}

export async function scanFoodImage(input: {
  imageBase64: string;
  mime: string;
  language: string;
  fridgeMode: boolean;
  ai: AiSettings;
}) {
  if (!input.ai.groqApiKey.trim()) {
    throw new Error("Groq API key is not configured");
  }

  const foodOnlyMessage =
    "I only provide food-related recipes. Please scan a fridge, ingredients, or a dish.";
  const instruction = buildScanInstruction(input.ai, input.language, foodOnlyMessage);

  const userText = input.fridgeMode
    ? "This is a fridge or ingredients photo. List only edible items you see."
    : "This is a finished dish photo. Name the dish and its visible ingredients.";

  const parsed = await groqChat({
    apiKey: input.ai.groqApiKey,
    model: input.ai.visionModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: instruction },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:${input.mime};base64,${input.imageBase64}` } },
        ],
      },
    ],
  });

  const isFood = parsed.is_food === true;
  const ingredients: string[] = [];
  if (Array.isArray(parsed.ingredients)) {
    for (const item of parsed.ingredients) {
      const name = String(item).trim();
      if (name) ingredients.push(name);
    }
  }

  if (!isFood) {
    return {
      is_food: false,
      message: String(parsed.message ?? "").trim() || foodOnlyMessage,
      ingredients: [] as string[],
      dish_name: null as string | null,
    };
  }

  return {
    is_food: true,
    message: "",
    ingredients,
    dish_name: String(parsed.dish_name ?? "").trim() || null,
  };
}
