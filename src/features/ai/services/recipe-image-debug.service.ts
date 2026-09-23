import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUploadDir } from "@/features/upload/utils/storage";

export type RecipeImageAttemptLog = {
  model: string;
  seed: number;
  ok: boolean;
  error?: string;
  sharpness?: number;
  httpStatus?: number;
  ms?: number;
};

export type RecipeImagePromptDebug = {
  recipeLanguageInput: string;
  contentLanguageCode: string;
  translateFrom: string;
  translatedToEnglish: boolean;
  titleBefore: string;
  titleAfter: string;
  ingredientsSampleBefore: string[];
  ingredientsSampleAfter: string[];
};

export function recipeImageDebugEnabled() {
  return process.env.RECIPE_IMAGE_DEBUG === "1" || process.env.NODE_ENV !== "production";
}

export function logRecipeImageDebug(event: string, payload: Record<string, unknown>) {
  if (!recipeImageDebugEnabled()) return;
  console.info(`[recipe-image] ${event}`, payload);
}

export function logRecipeImageFailure(payload: Record<string, unknown>) {
  console.warn("[recipe-image] generation_failed", payload);
}

export async function persistRecipeImageDebugFile(payload: Record<string, unknown>) {
  const id = randomUUID();
  const folder = "recipes/ai-debug";
  const dir = path.join(getUploadDir(), folder);
  await mkdir(dir, { recursive: true });
  const relative = path.posix.join(folder, `${id}.json`);
  const full = {
    savedAt: new Date().toISOString(),
    ...payload,
  };
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify(full, null, 2));
  return `/uploads/${relative}`;
}
