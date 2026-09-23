/** Keep URL builder aligned with src/features/ai/utils/pollinations-image.ts */
export const POLLINATIONS_IMAGE_MODEL = "flux";
export const POLLINATIONS_IMAGE_WIDTH = 768;
export const POLLINATIONS_IMAGE_HEIGHT = 768;

export function buildPollinationsRecipeImageUrl(prompt, seed, model = POLLINATIONS_IMAGE_MODEL) {
  const params = new URLSearchParams({
    width: String(POLLINATIONS_IMAGE_WIDTH),
    height: String(POLLINATIONS_IMAGE_HEIGHT),
    model,
    enhance: "false",
    seed: String(Math.floor(Number(seed))),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(String(prompt).trim())}?${params.toString()}`;
}
