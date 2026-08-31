import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  MAX_UPLOAD_BYTES,
  safeSubdir,
  sniffImage,
} from "@/features/upload/utils/validate";

export function getUploadDir() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "uploads");
}

export async function saveUpload(file: File, subdir = "images") {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File too large (max 10MB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("File too large (max 10MB)");
  }

  const sniffed = sniffImage(buffer);
  if (!sniffed) {
    throw new Error("Only JPG, PNG, WebP, and GIF images are allowed");
  }

  const filename = `${randomUUID()}${sniffed.ext}`;
  const folder = safeSubdir(subdir);
  const dir = path.join(/* turbopackIgnore: true */ getUploadDir(), folder);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(/* turbopackIgnore: true */ dir, filename);
  await writeFile(fullPath, buffer);
  return path.posix.join(folder, filename);
}

export function publicUploadPath(relativePath: string) {
  return `/uploads/${relativePath.replace(/\\/g, "/")}`;
}

export function resolvePublicUpload(segments: string[]) {
  const root = getUploadDir();
  const fullPath = path.resolve(root, ...segments);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return fullPath;
}