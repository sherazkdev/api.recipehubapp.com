export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_BULK_FILES = 40;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 300;
export const ALLOWED_SUBDIRS = ["recipes", "cuisines", "flags"] as const;

export type AllowedSubdir = (typeof ALLOWED_SUBDIRS)[number];

export function sniffImage(buffer: Buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: ".png", mime: "image/png" };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { ext: ".gif", mime: "image/gif" };
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { ext: ".webp", mime: "image/webp" };
  }
  return null;
}

export function safeSubdir(value: string | null | undefined): AllowedSubdir {
  const subdir = (value ?? "recipes").trim().toLowerCase();
  return (ALLOWED_SUBDIRS as readonly string[]).includes(subdir)
    ? (subdir as AllowedSubdir)
    : "recipes";
}

export function isSafeImagePath(value: string) {
  const path = value.trim();
  if (!path) return true;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  return /^(recipes|cuisines|flags)\/[a-z0-9._-]+\.(jpe?g|png|webp|gif)$/i.test(path);
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
}