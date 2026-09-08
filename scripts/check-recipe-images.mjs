/**
 * Report recipe imagePath / imageUrl status.
 * Run on VPS after seed + upload: node scripts/check-recipe-images.mjs
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim().replace(/\/$/, "");
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");

function toImageUrl(origin, imagePath) {
  const value = (imagePath ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const rel = value.startsWith("/") ? value : `/uploads/${value}`;
  return origin ? `${origin}${rel}` : rel;
}

async function main() {
  if (!MONGODB_URI) {
    console.error("Set MONGODB_URI in env");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const Recipe = mongoose.connection.collection("recipes");

  const recipes = await Recipe.find({}, { projection: { slug: 1, imagePath: 1, status: 1 } }).toArray();
  const withPath = recipes.filter((r) => (r.imagePath ?? "").trim());
  const missing = recipes.filter((r) => !(r.imagePath ?? "").trim());

  let diskFiles = 0;
  const recipesDir = path.join(UPLOAD_DIR, "recipes");
  if (fs.existsSync(recipesDir)) {
    diskFiles = fs.readdirSync(recipesDir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).length;
  }

  console.log("=== Recipe images status ===");
  console.log(`PUBLIC_APP_URL: ${PUBLIC_APP_URL || "(not set — imageUrl will use request host or relative /uploads/...)"}`);
  console.log(`Upload dir: ${UPLOAD_DIR}`);
  console.log(`Files on disk (uploads/recipes): ${diskFiles}`);
  console.log(`Recipes total: ${recipes.length}`);
  console.log(`With imagePath: ${withPath.length}`);
  console.log(`Missing imagePath: ${missing.length}`);

  if (withPath.length) {
    const sample = withPath[0];
    console.log("\nSample:");
    console.log(`  slug: ${sample.slug}`);
    console.log(`  imagePath: ${sample.imagePath}`);
    console.log(`  imageUrl: ${toImageUrl(PUBLIC_APP_URL, sample.imagePath)}`);
  }

  if (missing.length) {
    console.log("\nRecipes without imagePath:");
    for (const row of missing.slice(0, 20)) console.log(`  - ${row.slug}`);
    if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
