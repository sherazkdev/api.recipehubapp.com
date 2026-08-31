export function mediaSrc(path: string) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  return `/uploads/${path}`;
}

export function recipeImageSrc(recipe: { imageUrl?: string; imagePath?: string }) {
  if (recipe.imageUrl) return recipe.imageUrl;
  return mediaSrc(recipe.imagePath ?? "");
}
