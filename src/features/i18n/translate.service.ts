import { lang, translate } from "bing-translate-api";
import { Language } from "@/features/languages/models/language.model";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";
import { mapLimit } from "@/shared/utils/async";

const SKIP_UNITS = new Set([
  "g",
  "kg",
  "mg",
  "ml",
  "l",
  "oz",
  "lb",
  "tbsp",
  "tsp",
  "cup",
  "cups",
  "pcs",
  "pc",
]);

const ENGINE_LANG: Record<string, string> = {
  zh: "zh-Hans",
};

const BATCH_SEP = " ¶ ";
const MAX_BATCH_CHARS = 900;
const translationCache = getCache("translations", 2000, 1000 * 60 * 60 * 24);

function engineLang(code: string) {
  const mapped = ENGINE_LANG[code.toLowerCase()] ?? code;
  return lang.getLangCode(mapped) ?? mapped;
}

function shouldSkip(text: string) {
  const value = text.trim();
  if (!value) return true;
  if (/^[\d.,/+-]+$/.test(value)) return true;
  if (SKIP_UNITS.has(value.toLowerCase())) return true;
  return false;
}

function rememberTranslation(sourceLang: string, targetLang: string, original: string, value: string) {
  const result = value.trim();
  if (!result || result.toLowerCase() === original.trim().toLowerCase()) return;
  cacheSet(translationCache, `${sourceLang}:${targetLang}:${original.trim()}`, { value: result });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function translateRaw(text: string, targetLang: string, sourceLang = "en") {
  const result = await withTimeout(translate(text, sourceLang, engineLang(targetLang)), 20_000, null);
  return result?.translation?.trim() || text;
}

export async function translateText(text: string, targetLang: string, sourceLang = "en") {
  const value = text.trim();
  if (!value || targetLang === sourceLang || shouldSkip(value)) return text;

  const key = `${sourceLang}:${targetLang}:${value}`;
  const cached = cacheGet<{ value: string }>(translationCache, key);
  if (cached?.value) return cached.value;

  const result = (await translateRaw(value, targetLang, sourceLang)).trim() || text;
  rememberTranslation(sourceLang, targetLang, value, result);
  return result;
}

export async function translateMany(texts: string[], targetLang: string, sourceLang = "en") {
  if (targetLang === sourceLang) return texts;

  const results = [...texts];
  const pending: Array<[number, string]> = [];

  texts.forEach((text, index) => {
    if (shouldSkip(text)) {
      results[index] = text;
      return;
    }
    const cached = cacheGet<{ value: string }>(translationCache, `${sourceLang}:${targetLang}:${text.trim()}`);
    if (cached?.value) {
      results[index] = cached.value;
      return;
    }
    pending.push([index, text]);
  });

  const batches: Array<Array<[number, string]>> = [];
  let current: Array<[number, string]> = [];
  let chars = 0;
  for (const entry of pending) {
    const size = entry[1].length + BATCH_SEP.length;
    if (current.length && chars + size > MAX_BATCH_CHARS) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(entry);
    chars += size;
  }
  if (current.length) batches.push(current);

  await mapLimit(batches, 3, async (batch) => {
    if (batch.length === 1) {
      const [index, original] = batch[0];
      const value = await translateText(original, targetLang, sourceLang);
      results[index] = value;
      return;
    }

    const joined = batch.map(([, text]) => text).join(BATCH_SEP);
    const translated = await translateRaw(joined, targetLang, sourceLang);
    const parts = translated.split(BATCH_SEP).map((part) => part.trim());

    if (parts.length === batch.length) {
      batch.forEach(([index, original], partIndex) => {
        const value = parts[partIndex] || original;
        results[index] = value;
        rememberTranslation(sourceLang, targetLang, original, value);
      });
      return;
    }

    await mapLimit(batch, 4, async ([index, original]) => {
      results[index] = await translateText(original, targetLang, sourceLang);
    });
  });

  return results;
}

const langCodeCache = getCache("lang-codes", 4, 120_000);

export async function getActiveLanguageCodes() {
  const cached = cacheGet<{ codes: string[] }>(langCodeCache, "active");
  if (cached?.codes?.length) return cached.codes;

  const languages = await Language.find({ isActive: true }).select("code").lean();
  const codes = languages.map((item) => item.code.toLowerCase());
  if (!codes.includes("en")) codes.unshift("en");
  const unique = [...new Set(codes)];
  cacheSet(langCodeCache, "active", { codes: unique });
  return unique;
}

export function isTranslatableUnit(unit: string) {
  return !shouldSkip(unit);
}
