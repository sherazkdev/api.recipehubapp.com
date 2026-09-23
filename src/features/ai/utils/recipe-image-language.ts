import { Language } from "@/features/languages/models/language.model";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";

/** Detect Arabic / RTL scripts in recipe text (image prompts should be English-only). */
export function hasArabicScript(text: string) {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
}

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  arabic: "ar",
  urdu: "ur",
  hindi: "hi",
  french: "fr",
  spanish: "es",
  german: "de",
  italian: "it",
  portuguese: "pt",
  turkish: "tr",
  indonesian: "id",
  malay: "ms",
  bengali: "bn",
  russian: "ru",
  ukrainian: "uk",
  chinese: "zh-Hans",
  mandarin: "zh-Hans",
  japanese: "ja",
  korean: "ko",
  thai: "th",
  vietnamese: "vi",
  persian: "fa",
  farsi: "fa",
  pashto: "ps",
  punjabi: "pa",
  tamil: "ta",
  telugu: "te",
  marathi: "mr",
  gujarati: "gu",
  swahili: "sw",
  dutch: "nl",
  polish: "pl",
  romanian: "ro",
};

const langResolveCache = getCache("recipe-image-lang", 200, 1000 * 60 * 10);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recipe text is OK inside an English Pollinations prompt (Latin + common punctuation). */
export function isLatinRecipeText(text: string) {
  const letters = text.replace(/[\d\s.,/+%()\-'"&]/g, "");
  if (!letters) return true;
  const nonLatin = letters.replace(/[A-Za-z\u00C0-\u024F]/g, "");
  return nonLatin.length / letters.length < 0.12;
}

export function recipeLanguageToCode(language: string) {
  const value = language.trim().toLowerCase();
  if (!value) return "en";
  if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(value)) {
    const base = value.split("-")[0];
    if (base === "zh") return value.includes("hant") ? "zh-Hant" : "zh-Hans";
    return base;
  }
  if (LANGUAGE_ALIASES[value]) return LANGUAGE_ALIASES[value];
  for (const [name, code] of Object.entries(LANGUAGE_ALIASES)) {
    if (value.includes(name)) return code;
  }
  return value.length <= 4 ? value : "";
}

export function recipeNeedsEnglishImagePrompt(contentLanguageCode: string, textBlob: string) {
  const code = contentLanguageCode.toLowerCase();
  if (code && code !== "en" && !code.startsWith("en-")) return true;
  if (!isLatinRecipeText(textBlob)) return true;
  return hasArabicScript(textBlob);
}

/** Guess Bing source lang when UI says English but recipe text is non-Latin. */
export function detectScriptSourceLanguage(text: string): string {
  if (hasArabicScript(text)) return "ar";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  if (/[\u0E00-\u0E7F]/.test(text)) return "th";
  if (/[\u3040-\u30FF]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-Hans";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
}

export async function resolveRecipeContentLanguageCode(languageLabel: string): Promise<string> {
  const trimmed = languageLabel.trim();
  if (!trimmed) return "en";

  const sync = recipeLanguageToCode(trimmed);
  if (sync && sync !== trimmed.toLowerCase()) return sync;
  if (/^[a-z]{2}(-[a-z]{2,4})?$/i.test(trimmed)) return recipeLanguageToCode(trimmed) || "en";

  const cacheKey = trimmed.toLowerCase();
  const cached = cacheGet<{ code: string }>(langResolveCache, cacheKey);
  if (cached?.code) return cached.code;

  const exact = new RegExp(`^${escapeRegex(trimmed)}$`, "i");
  try {
    const doc = await Language.findOne({
      isActive: true,
      $or: [{ code: trimmed.toLowerCase() }, { name: exact }, { nativeName: exact }],
    })
      .select("code name")
      .lean();

    const code = doc?.code?.toLowerCase() || sync || "en";
    cacheSet(langResolveCache, cacheKey, { code });
    return code;
  } catch {
    return sync || "en";
  }
}
