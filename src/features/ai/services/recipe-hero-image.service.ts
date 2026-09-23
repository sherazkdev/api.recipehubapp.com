import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createHash, randomInt, randomUUID } from "crypto";
import sharp from "sharp";
import type { AiSettings } from "@/features/settings/types";
import {
  buildPollinationsRecipeImageUrl,
  POLLINATIONS_IMAGE_WIDTH,
  POLLINATIONS_RECIPE_IMAGE_MODELS,
} from "@/features/ai/utils/pollinations-image";
import { measureSharpnessScore, passesSharpnessGate } from "@/features/ai/utils/image-sharpness";
import { fetchPollinationsImage } from "@/features/ai/utils/pollinations-fetch";
import { pollinationsBearerToken } from "@/features/ai/utils/pollinations-auth";
import { prepareServedRecipeImageBuffer } from "@/features/ai/utils/pollinations-watermark";
import { prepareRecipeImagePrompt } from "@/features/ai/services/recipe-image-prompt.service";
import {
  findCatalogRecipeImageUrl,
  importUsefulFolderImageIfExists,
} from "@/features/ai/services/catalog-recipe-image.service";
import {
  logRecipeImageDebug,
  logRecipeImageFailure,
  persistRecipeImageDebugFile,
  type RecipeImageAttemptLog,
  type RecipeImagePromptDebug,
} from "@/features/ai/services/recipe-image-debug.service";
import { getUploadDir } from "@/features/upload/utils/storage";
import { sniffImage } from "@/features/upload/utils/validate";
import { toImageUrl } from "@/shared/http/media-url";
import { connectDb } from "@/shared/db/connect";

const MIN_IMAGE_BYTES = 8_000;
const MIN_SHARPNESS_SCORE = 120;
const MAX_ATTEMPTS_PER_MODEL = 2;

function configuredOrigin() {
  return (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim().replace(/\/$/, "");
}

function publicUrlForRelative(relative: string, origin: string) {
  if (origin) return toImageUrl(origin, relative);
  return `/uploads/${relative}`;
}

function extensionFromContentType(contentType: string, buffer: Buffer) {
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  const sniffed = sniffImage(buffer);
  return sniffed?.ext ?? ".jpg";
}

type RecipeImageSaveMeta = {
  purpose: "recipe-hero";
  recipeTitle: string;
  imagePrompt: string;
  seed: number;
  model: string;
  requestedUrlRedacted: string;
  finalUrlRedacted: string;
  redirected: boolean;
  providerSha256_16: string;
  providerBytes: number;
  imageWidth: number | null;
  imageHeight: number | null;
  responseHeaders: Record<string, string>;
  queryPreservedOnRedirect: boolean;
  requestModel: string | null;
  finalModelParam: string | null;
  generationMs: number;
  watermarkMitigation: Record<string, unknown>;
  servedSha256_16: string;
  servedBytes: number;
  servedWidth: number | null;
  servedHeight: number | null;
};

/** Recipe-only AI images: exact provider bytes + sidecar metadata (always saved). */
async function persistRecipeGeneratedImage(
  providerBuffer: Buffer,
  servedBuffer: Buffer,
  contentType: string,
  meta: RecipeImageSaveMeta,
) {
  const ext = extensionFromContentType(contentType, providerBuffer);
  const id = randomUUID();
  const folder = "recipes/ai-generated";
  const dir = path.join(getUploadDir(), folder);
  await mkdir(dir, { recursive: true });

  const providerRelative = path.posix.join(folder, `${id}.provider${ext}`);
  const servedRelative = path.posix.join(folder, `${id}${ext}`);
  const metaRelative = path.posix.join(folder, `${id}.meta.json`);

  await writeFile(path.join(dir, `${id}.provider${ext}`), providerBuffer);
  await writeFile(path.join(dir, `${id}${ext}`), servedBuffer);
  await writeFile(path.join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2));

  return { servedRelative, providerRelative, metaRelative, ext };
}

async function generateAiHeroImage(
  recipe: Record<string, unknown>,
  origin: string,
  imagePrompt: string,
  promptDebug: RecipeImagePromptDebug,
) {
  const recipeTitle = String(recipe.title ?? "").trim() || "untitled-recipe";
  let lastError = "";
  const attempts: RecipeImageAttemptLog[] = [];

  logRecipeImageDebug("prompt_ready", {
    recipeTitle,
    imagePrompt,
    promptDebug,
  });

  for (const model of POLLINATIONS_RECIPE_IMAGE_MODELS) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      const seed = randomInt(1, 2_147_483_647);
      const url = buildPollinationsRecipeImageUrl(imagePrompt, seed, model);
      try {
        const fetched = await fetchPollinationsImage(url);
        if (!fetched.ok || fetched.buffer.length < MIN_IMAGE_BYTES) {
          lastError = `HTTP ${fetched.status} (${fetched.contentType})`;
          attempts.push({
            model,
            seed,
            ok: false,
            error: lastError,
            httpStatus: fetched.status,
            ms: fetched.ms,
          });
          continue;
        }
        if (!fetched.contentType.includes("image") && !sniffImage(fetched.buffer)) {
          lastError = "response was not an image";
          attempts.push({ model, seed, ok: false, error: lastError, ms: fetched.ms });
          continue;
        }

        const sharpness = await measureSharpnessScore(fetched.buffer);
        if (!passesSharpnessGate(sharpness, MIN_SHARPNESS_SCORE)) {
          lastError = `image too soft (sharpness ${sharpness.toFixed(0)})`;
          attempts.push({ model, seed, ok: false, error: lastError, sharpness, ms: fetched.ms });
          continue;
        }

        const sharpMeta = await sharp(fetched.buffer).metadata();
        const { servedBuffer, mitigation } = await prepareServedRecipeImageBuffer(fetched.buffer, {
          nologoRequested: true,
          bearerTokenSent: Boolean(pollinationsBearerToken()),
        });
        const servedMeta = await sharp(servedBuffer).metadata();
        const servedSha256 = createHash("sha256").update(servedBuffer).digest("hex").slice(0, 16);
        const saved = await persistRecipeGeneratedImage(fetched.buffer, servedBuffer, fetched.contentType, {
          purpose: "recipe-hero",
          recipeTitle,
          imagePrompt,
          seed,
          model,
          requestedUrlRedacted: fetched.requestedUrlRedacted,
          finalUrlRedacted: fetched.finalUrlRedacted,
          redirected: fetched.redirected,
          providerSha256_16: fetched.sha256_16,
          providerBytes: fetched.buffer.length,
          imageWidth: sharpMeta.width ?? null,
          imageHeight: sharpMeta.height ?? null,
          responseHeaders: fetched.headers,
          queryPreservedOnRedirect: fetched.queryPreservedOnRedirect,
          requestModel: fetched.requestModel,
          finalModelParam: fetched.finalModelParam,
          generationMs: fetched.ms,
          watermarkMitigation: mitigation,
          servedSha256_16: servedSha256,
          servedBytes: servedBuffer.length,
          servedWidth: servedMeta.width ?? null,
          servedHeight: servedMeta.height ?? null,
        });

        if (process.env.POLLINATIONS_DEBUG === "1") {
          console.info("[pollinations]", {
            requestedUrl: fetched.requestedUrlRedacted,
            finalUrl: fetched.finalUrlRedacted,
            sha256_16: fetched.sha256_16,
            headers: fetched.headers,
          });
        }

        attempts.push({ model, seed, ok: true, sharpness, ms: fetched.ms });

        return {
          url: publicUrlForRelative(saved.servedRelative, origin),
          imagePrompt,
          seed,
          model,
          generationMs: fetched.ms,
          providerBytes: fetched.buffer.length,
          imageWidth: servedMeta.width ?? sharpMeta.width ?? null,
          imageHeight: servedMeta.height ?? sharpMeta.height ?? null,
          imageFormat: servedMeta.format ?? sharpMeta.format ?? null,
          providerDebugPath: `/uploads/${saved.providerRelative}`,
          recipeMetaPath: `/uploads/${saved.metaRelative}`,
          promptDebug,
          attempts,
          debugLogPath: null as string | null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        attempts.push({ model, seed, ok: false, error: lastError });
      }
    }
  }

  const debugLogPath = await persistRecipeImageDebugFile({
    status: "failed",
    recipeTitle,
    imagePrompt,
    promptDebug,
    attempts,
    lastError,
  });

  logRecipeImageFailure({
    recipeTitle,
    imagePrompt,
    promptDebug,
    attempts,
    lastError,
    debugLogPath,
  });

  return {
    url: "",
    imagePrompt,
    seed: null,
    generationMs: null as number | null,
    providerBytes: null as number | null,
    imageWidth: null,
    imageHeight: null,
    imageFormat: null as string | null,
    providerDebugPath: null as string | null,
    recipeMetaPath: null as string | null,
    promptDebug,
    attempts,
    debugLogPath,
    error: lastError || "fetch failed",
  };
}

export type RecipeHeroImageResult = {
  url: string;
  imagePrompt: string;
  seed: number | null;
  model?: string;
  generationMs?: number | null;
  providerBytes?: number | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageFormat?: string | null;
  providerDebugPath?: string | null;
  recipeMetaPath?: string | null;
  promptDebug?: RecipeImagePromptDebug;
  attempts?: RecipeImageAttemptLog[];
  debugLogPath?: string | null;
  error?: string;
};

export async function resolveRecipeHeroImage(input: {
  recipe: Record<string, unknown>;
  ai: AiSettings;
  recipeLanguage?: string;
}): Promise<RecipeHeroImageResult> {
  await connectDb();
  const origin = configuredOrigin();
  const title = String(input.recipe.title ?? "").trim();
  const recipeLanguage = input.recipeLanguage?.trim() || "English";
  const { imagePrompt, debug: promptDebug } = await prepareRecipeImagePrompt(input.recipe, recipeLanguage);

  const catalog = await findCatalogRecipeImageUrl(title, origin);
  if (catalog) {
    return {
      url: catalog,
      imagePrompt,
      seed: null,
      model: "catalog",
      promptDebug,
      attempts: [],
    };
  }

  const useful = await importUsefulFolderImageIfExists(title, origin);
  if (useful) {
    return {
      url: useful,
      imagePrompt,
      seed: null,
      model: "useful-folder",
      promptDebug,
      attempts: [],
    };
  }

  if (input.ai.imageSource !== "pollinations") {
    return { url: "", imagePrompt, seed: null, promptDebug, attempts: [] };
  }

  return generateAiHeroImage(input.recipe, origin, imagePrompt, promptDebug);
}
