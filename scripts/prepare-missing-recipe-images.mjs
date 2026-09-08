import fs from "fs";
import path from "path";

const SOURCE_DIR = path.join(process.cwd(), "recipe-hub-recipes-images");
const USEFUL_DIR = path.join(process.cwd(), "recipes-upload-ready", "useful");
const MISSING_DIR = path.join(process.cwd(), "recipes-upload-ready", "missing");

/** Slug → best available source file (verified manually) */
const MISSING_RECIPE_SOURCES = {
  "bun-thit-nuong": {
    source: "Bun Thit Nuong.png",
    note: "Exact match — re-upload if bulk upload skipped this recipe.",
  },
  "spicy-chicken-curry": {
    source: "butter chicken.png",
    note: "Placeholder: closest Indian chicken curry in source folder (not katsu curry).",
  },
  "garlic-bread": {
    source: "Focaccia Bread.png",
    note: "Placeholder: no garlic bread image in source; using Italian bread until you replace it.",
  },
};

function main() {
  fs.mkdirSync(MISSING_DIR, { recursive: true });

  const entries = [];

  for (const [slug, meta] of Object.entries(MISSING_RECIPE_SOURCES)) {
    const usefulPath = path.join(USEFUL_DIR, `${slug}.png`);
    const sourcePath = path.join(SOURCE_DIR, meta.source);
    const targetPath = path.join(MISSING_DIR, `${slug}.png`);

    let copiedFrom = meta.source;

    if (fs.existsSync(usefulPath)) {
      fs.copyFileSync(usefulPath, targetPath);
      copiedFrom = `useful/${slug}.png`;
    } else if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      console.error(`Source not found for ${slug}: ${meta.source}`);
      continue;
    }

    entries.push({ slug, output: `${slug}.png`, copiedFrom, note: meta.note });
    console.log(`+ ${slug}.png  <-  ${copiedFrom}`);
  }

  fs.writeFileSync(
    path.join(MISSING_DIR, "README.txt"),
    [
      "MISSING — upload these 3 recipes manually in admin",
      "",
      "Each file is named by slug. Match slug to recipe when uploading.",
      "",
      ...entries.map((e, i) => `${i + 1}. ${e.slug}.png\n   from: ${e.copiedFrom}\n   note: ${e.note}`),
      "",
      "After upload, these recipes should show images in admin.",
    ].join("\n"),
    "utf8",
  );

  fs.writeFileSync(
    path.join(MISSING_DIR, "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), recipes: entries }, null, 2)}\n`,
    "utf8",
  );

  console.log(`\nMissing folder ready: ${MISSING_DIR}`);
  console.log(`Files: ${entries.length}`);
}

main();
