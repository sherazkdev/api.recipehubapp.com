import type { AiSettings } from "@/features/settings/types";

type GroqMessage =
  | { role: string; content: string }
  | {
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    };

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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

export async function groqChat(input: {
  apiKey: string;
  model: string;
  messages: GroqMessage[];
  temperature?: number;
}) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature ?? 0.7,
      messages: input.messages,
      response_format: { type: "json_object" },
    }),
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    const message = payload.error?.message ?? "Groq request failed";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) {
    throw new Error("Groq returned invalid JSON");
  }
  return parsed;
}

export async function testGroqConnection(apiKey: string, model: string) {
  const started = Date.now();
  await groqChat({
    apiKey,
    model,
    temperature: 0,
    messages: [
      { role: "system", content: "Reply with JSON: {\"ok\":true}" },
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
    const title = String(recipe.title ?? input.prompt);
    recipe.image =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(title)}` +
      "?width=512&height=512&nologo=true";
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
