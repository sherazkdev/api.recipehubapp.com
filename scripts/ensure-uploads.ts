import { mkdir, writeFile } from "fs/promises";
import path from "path";

async function main() {
  const dir = path.join(process.cwd(), "uploads", ".gitkeep");
  await mkdir(path.dirname(dir), { recursive: true });
  await writeFile(dir, "");
  console.log("Created uploads directory");
}

void main();
