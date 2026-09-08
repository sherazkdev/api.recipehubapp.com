/**
 * Link slug-named files in uploads/recipes/ to Recipe.imagePath.
 * Use when you copied images to VPS manually (chicken-tikka-masala.png etc).
 *
 *   node scripts/sync-recipe-image-paths.mjs          # dry run
 *   node scripts/sync-recipe-image-paths.mjs --apply  # update MongoDB
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
const MONGODB_URI = process.env.MONGODB_URI;
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
const RECIPES_DIR = path.join(UPLOAD_DIR, "recipes");

function slugFromFilename(file) {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

async function main() {
  if (!MONGODB_URI) {
    console.error("Set MONGODB_URI in env");
    process.exit(1);
  }
  if (!fs.existsSync(RECIPES_DIR)) {
    console.error(`Folder not found: ${RECIPES_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(RECIPES_DIR)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));

  await mongoose.connect(MONGODB_URI);
  const Recipe = mongoose.connection.collection("recipes");

  const recipes = await Recipe.find({}, { projection: { slug: 1, imagePath: 1 } }).toArray();
  const bySlug = new Map(recipes.map((r) => [r.slug, r]));

  let linked = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const file of files.sort()) {
    const slug = slugFromFilename(file);
    const recipe = bySlug.get(slug);
    const imagePath = path.posix.join("recipes", file);

    if (!recipe) {
      unmatched++;
      continue;
    }

    if ((recipe.imagePath ?? "").trim() === imagePath) {
      skipped++;
      continue;
    }

    if ((recipe.imagePath ?? "").trim() && recipe.imagePath !== imagePath) {
      console.log(`skip ${slug}: already has ${recipe.imagePath}`);
      skipped++;
      continue;
    }

    console.log(`${apply ? "update" : "would update"} ${slug} -> ${imagePath}`);
    if (apply) {
      await Recipe.updateOne({ _id: recipe._id }, { $set: { imagePath } });
    }
    linked++;
  }

  const stillMissing = recipes.filter((r) => {
    const p = (r.imagePath ?? "").trim();
    if (p) return false;
    return !files.some((f) => slugFromFilename(f) === r.slug);
  });

  console.log("\n=== Summary ===");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN (use --apply to save)"}`);
  console.log(`Disk files: ${files.length}`);
  console.log(`Linked: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Unmatched files (no recipe slug): ${unmatched}`);
  console.log(`Recipes still missing image: ${stillMissing.length}`);
  if (stillMissing.length) {
    for (const r of stillMissing.slice(0, 15)) console.log(`  - ${r.slug}`);
    if (stillMissing.length > 15) console.log(`  ... +${stillMissing.length - 15} more`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
