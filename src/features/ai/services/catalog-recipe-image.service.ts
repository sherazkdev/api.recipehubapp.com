import { copyFile, access, mkdir } from "fs/promises";
import path from "path";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { getUploadDir } from "@/features/upload/utils/storage";
import { toImageUrl } from "@/shared/http/media-url";
import { slugify } from "@/shared/utils/http";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fileExists(fullPath: string) {
  try {
    await access(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function recipeUrlFromPath(imagePath: string, origin: string) {
  const trimmed = imagePath.trim();
  if (!trimmed) return null;
  if (origin) return toImageUrl(origin, trimmed);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `/uploads/${trimmed.replace(/^\/+/, "")}`;
}

async function findRecipeWithImageBySlug(slug: string) {
  return Recipe.findOne({
    slug,
    status: "published",
    imagePath: { $exists: true, $regex: /\S/ },
  })
    .select("imagePath slug")
    .lean();
}

async function findRecipeWithImageByTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const exact = await RecipeContent.findOne({
    langCode: "en",
    title: new RegExp(`^${escapeRegex(trimmed)}$`, "i"),
  })
    .select("recipeId")
    .lean();
  if (exact?.recipeId) {
    const recipe = await Recipe.findOne({
      _id: exact.recipeId,
      imagePath: { $exists: true, $regex: /\S/ },
    })
      .select("imagePath slug")
      .lean();
    if (recipe) return recipe;
  }

  const slug = slugify(trimmed);
  return findRecipeWithImageBySlug(slug);
}

/** Published catalog photo when title/slug matches (real PNG/JPG, not AI). */
export async function findCatalogRecipeImageUrl(title: string, origin: string) {
  const slug = slugify(title);
  let recipe = await findRecipeWithImageBySlug(slug);
  if (!recipe) recipe = await findRecipeWithImageByTitle(title);
  if (!recipe?.imagePath) return null;
  return recipeUrlFromPath(recipe.imagePath, origin);
}

/** Copy curated file from recipes-upload-ready/useful into uploads/recipes/. */
export async function importUsefulFolderImageIfExists(title: string, origin: string) {
  const slug = slugify(title);
  if (!slug) return null;

  const usefulDir = path.join(process.cwd(), "recipes-upload-ready", "useful");
  const extensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (const ext of extensions) {
    const source = path.join(usefulDir, `${slug}${ext}`);
    if (!(await fileExists(source))) continue;

    const destDir = path.join(getUploadDir(), "recipes");
    await mkdir(destDir, { recursive: true });
    const filename = `${slug}${ext}`;
    const dest = path.join(destDir, filename);
    if (!(await fileExists(dest))) {
      await copyFile(source, dest);
    }
    const relative = path.posix.join("recipes", filename);
    return recipeUrlFromPath(relative, origin);
  }

  return null;
}
