/** Legacy unauthenticated route used by the app today. Documented API: GET https://gen.pollinations.ai/image/{prompt} (Bearer sk_*). */
export const POLLINATIONS_IMAGE_MODEL = "flux";

export const POLLINATIONS_RECIPE_IMAGE_MODELS = ["flux", "zimage", "turbo"] as const;

/** Provider returns 768×768 for this endpoint even when 1024 is requested (verified in scripts/image-diagnosis). */
export const POLLINATIONS_IMAGE_WIDTH = 768;
export const POLLINATIONS_IMAGE_HEIGHT = 768;

export function buildPollinationsRecipeImageUrl(
  prompt: string,
  seed: number,
  model: string = POLLINATIONS_IMAGE_MODEL,
) {
  const params = new URLSearchParams({
    width: String(POLLINATIONS_IMAGE_WIDTH),
    height: String(POLLINATIONS_IMAGE_HEIGHT),
    model,
    enhance: "false",
    private: "true",
    nologo: "true",
    nofeed: "true",
    seed: String(Math.floor(seed)),
  });
  const full = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?${params.toString()}`;
  return full;
}

export type { RecipeImagePromptContext } from "@/features/ai/utils/recipe-image-prompt-builder";
export { buildRecipeImagePromptFromContext } from "@/features/ai/utils/recipe-image-prompt-builder";
