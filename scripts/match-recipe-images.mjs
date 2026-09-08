import fs from "fs";
import path from "path";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeFileName(file) {
  return slugify(path.basename(file, path.extname(file)).replace(/['',]/g, "").trim());
}

const seedDir = path.join(process.cwd(), "scripts/seed-data");
const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith(".ts") && f !== "types.ts");

const recipes = [];
for (const file of seedFiles) {
  const content = fs.readFileSync(path.join(seedDir, file), "utf8");
  const blocks = content.split(/\{\s*\n\s*slug:/).slice(1);
  for (const block of blocks) {
    const slug = block.match(/^ "([^"]+)"/)?.[1];
    const title = block.match(/title:\s*"([^"]+)"/)?.[1];
    if (slug) recipes.push({ slug, title: title ?? slug });
  }
}

const seen = new Set();
const uniqueRecipes = recipes.filter((r) => {
  if (seen.has(r.slug)) return false;
  seen.add(r.slug);
  return true;
});

const imgDir = path.join(process.cwd(), "recipe-hub-recipes-images");
const imageFiles = fs.readdirSync(imgDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

const slugToFiles = new Map();
const fileNorm = new Map();
for (const file of imageFiles) {
  const norm = normalizeFileName(file);
  fileNorm.set(file, norm);
  if (!slugToFiles.has(norm)) slugToFiles.set(norm, []);
  slugToFiles.get(norm).push(file);
}

const exact = [];
const fuzzy = [];
const missing = [];
const usedNorms = new Set();

for (const recipe of uniqueRecipes) {
  if (slugToFiles.has(recipe.slug)) {
    exact.push({ ...recipe, files: slugToFiles.get(recipe.slug) });
    usedNorms.add(recipe.slug);
    continue;
  }

  const titleSlug = slugify(recipe.title);
  if (slugToFiles.has(titleSlug)) {
    fuzzy.push({ ...recipe, matchedAs: titleSlug, files: slugToFiles.get(titleSlug), kind: "title-slug" });
    usedNorms.add(titleSlug);
    continue;
  }

  let best = null;
  for (const [norm, filesForNorm] of slugToFiles) {
    if (usedNorms.has(norm)) continue;
    const words = recipe.slug.split("-").filter((w) => w.length > 3);
    const hits = words.filter((w) => norm.includes(w)).length;
    if (hits >= 2 && (!best || hits > best.hits)) best = { norm, filesForNorm, hits };
  }

  if (best) {
    fuzzy.push({
      ...recipe,
      matchedAs: best.norm,
      files: best.filesForNorm,
      kind: "partial-words",
    });
    usedNorms.add(best.norm);
  } else {
    missing.push(recipe);
  }
}

const extra = imageFiles
  .filter((file) => !usedNorms.has(fileNorm.get(file)))
  .map((file) => ({ file, normalized: fileNorm.get(file) }))
  .sort((a, b) => a.normalized.localeCompare(b.normalized));

const uploadName = (slug) => `${slug}.png`;

console.log("=== SUMMARY ===");
console.log(`Recipes in seed: ${uniqueRecipes.length}`);
console.log(`Image files in folder: ${imageFiles.length}`);
console.log(`Exact slug match: ${exact.length}`);
console.log(`Fuzzy match: ${fuzzy.length}`);
console.log(`Total matched: ${exact.length + fuzzy.length}`);
console.log(`Recipes WITHOUT image: ${missing.length}`);
console.log(`Extra/unmatched images: ${extra.length}`);
console.log("");

console.log("=== EXACT MATCH (upload as slug.png) ===");
for (const item of exact.sort((a, b) => a.slug.localeCompare(b.slug))) {
  console.log(`${uploadName(item.slug)}  <-  ${item.files[0]}`);
}

console.log("");
console.log("=== FUZZY MATCH (rename to slug.png before upload) ===");
for (const item of fuzzy.sort((a, b) => a.slug.localeCompare(b.slug))) {
  console.log(`${uploadName(item.slug)}  <-  ${item.files[0]}  [${item.kind}: ${item.matchedAs}]`);
}

console.log("");
console.log("=== RECIPES MISSING IMAGE ===");
for (const item of missing.sort((a, b) => a.slug.localeCompare(b.slug))) {
  console.log(`${item.slug}  (${item.title})`);
}

console.log("");
console.log("=== EXTRA IMAGES (no recipe / faltoo) ===");
for (const item of extra) {
  console.log(`${item.file}  [norm: ${item.normalized}]`);
}
