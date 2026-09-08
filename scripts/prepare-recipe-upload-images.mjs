import fs from "fs";
import path from "path";

const SOURCE_DIR = path.join(process.cwd(), "recipe-hub-recipes-images");
const OUTPUT_ROOT = path.join(process.cwd(), "recipes-upload-ready");
const USEFUL_DIR = path.join(OUTPUT_ROOT, "useful");
const NOT_USEFUL_DIR = path.join(OUTPUT_ROOT, "not-useful");

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

function loadRecipes() {
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
  return recipes.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
}

/** Verified manual matches where filename differs from seed slug */
const MANUAL_MATCHES = {
  "beef-tacos": "mexican-dish-beef-tacos",
  "chicken-fricassee": "chicken-fricasse",
  "chicken-provencal": "chicken-provenal",
  "classic-bbq-pulled-pork": "american-dish-classic-bbq-pulled-pork",
  "duck-a-lorange": "duck-lorange",
  "greek-chicken-gyro": "mediterranean-dish-greek-chicken-gyro",
  "jjajangmyeon-black-bean-noodles": "jajangmyeon-black-bean-noodles",
  "middle-eastern-tabbouleh-salad": "tabbouleh-salad",
  "moules-marinieres": "moules-marinires",
  "pissaladiere": "pissaladire",
};

function pickSourceFile(slug, title, slugToFiles) {
  if (slugToFiles.has(slug)) {
    return { file: slugToFiles.get(slug)[0], match: "exact", matchedAs: slug };
  }

  const manual = MANUAL_MATCHES[slug];
  if (manual && slugToFiles.has(manual)) {
    return { file: slugToFiles.get(manual)[0], match: "manual", matchedAs: manual };
  }

  const titleSlug = slugify(title);
  if (titleSlug !== slug && slugToFiles.has(titleSlug)) {
    return { file: slugToFiles.get(titleSlug)[0], match: "title", matchedAs: titleSlug };
  }

  return null;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source folder not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const recipes = loadRecipes();
  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

  const slugToFiles = new Map();
  for (const file of sourceFiles) {
    const norm = normalizeFileName(file);
    if (!slugToFiles.has(norm)) slugToFiles.set(norm, []);
    slugToFiles.get(norm).push(file);
  }

  fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(USEFUL_DIR, { recursive: true });
  fs.mkdirSync(NOT_USEFUL_DIR, { recursive: true });

  const matched = [];
  const missing = [];
  const usedSourceFiles = new Set();

  for (const recipe of recipes.sort((a, b) => a.slug.localeCompare(b.slug))) {
    const picked = pickSourceFile(recipe.slug, recipe.title, slugToFiles);

    if (!picked) {
      missing.push(recipe);
      continue;
    }

    usedSourceFiles.add(picked.file);
    fs.copyFileSync(path.join(SOURCE_DIR, picked.file), path.join(USEFUL_DIR, `${recipe.slug}.png`));
    matched.push({
      slug: recipe.slug,
      title: recipe.title,
      source: picked.file,
      match: picked.match,
      matchedAs: picked.matchedAs,
      output: `${recipe.slug}.png`,
    });
  }

  const notUseful = [];
  for (const file of sourceFiles.sort((a, b) => a.localeCompare(b))) {
    if (usedSourceFiles.has(file)) continue;
    fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(NOT_USEFUL_DIR, file));
    notUseful.push(file);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    usefulDir: USEFUL_DIR,
    notUsefulDir: NOT_USEFUL_DIR,
    totalSeedRecipes: recipes.length,
    usefulImages: matched.length,
    notUsefulImages: notUseful.length,
    missingFromSeed: missing.length,
    matched,
    missingRecipes: missing,
    notUsefulFiles: notUseful,
  };

  fs.writeFileSync(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, "MISSING-FROM-SEED.txt"),
    [
      "Seed recipes without a matching image",
      `Total missing: ${missing.length} / ${recipes.length}`,
      "",
      ...missing.map((r, i) => `${i + 1}. ${r.slug}  (${r.title})`),
      "",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(USEFUL_DIR, "README.txt"),
    [
      "USEFUL — upload these images for seeded recipes",
      "",
      "Each file is named by recipe slug: {slug}.png",
      "Example: chicken-tikka-masala.png → recipe slug chicken-tikka-masala",
      "",
      `Ready to upload: ${matched.length} images`,
      `Seed recipes total: ${recipes.length}`,
      `Missing images: ${missing.length} (see ../MISSING-FROM-SEED.txt)`,
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(NOT_USEFUL_DIR, "README.txt"),
    [
      "NOT USEFUL — extra images not linked to any seeded recipe",
      "",
      "These files are kept for reference only. Do not bulk-upload with seed recipes.",
      "",
      `Extra images: ${notUseful.length}`,
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, "README.txt"),
    [
      "Recipe Hub — image folders for bulk upload",
      "",
      "useful/       → Seed recipe images renamed to slug (UPLOAD THESE)",
      "not-useful/   → Extra images not in seed data",
      "",
      `Seed recipes: ${recipes.length}`,
      `Matched (useful): ${matched.length}`,
      `Not useful: ${notUseful.length}`,
      `Missing from seed: ${missing.length}`,
      "",
      "See manifest.json for full mapping.",
      "See MISSING-FROM-SEED.txt for recipes without images.",
    ].join("\n"),
    "utf8",
  );

  console.log("=== Recipe image verification ===");
  console.log(`Source: ${SOURCE_DIR} (${sourceFiles.length} files)`);
  console.log(`Seed recipes: ${recipes.length}`);
  console.log(`useful/: ${matched.length} slug-named images`);
  console.log(`not-useful/: ${notUseful.length} extra images`);
  console.log(`Missing from seed: ${missing.length}`);
  if (missing.length) {
    console.log("\nMissing slugs:");
    for (const item of missing) console.log(`  - ${item.slug} (${item.title})`);
  }
  console.log(`\nOutput: ${OUTPUT_ROOT}`);
}

main();
