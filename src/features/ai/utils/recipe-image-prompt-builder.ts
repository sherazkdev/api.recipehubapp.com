import { isLatinRecipeText } from "@/features/ai/utils/recipe-image-language";

export type RecipeImagePromptContext = {
  title?: string;
  ingredients?: string[];
  tags?: string[];
  steps?: string[];
};

const HIDDEN_INGREDIENT =
  /\b(salt|pepper|black pepper|water|oil|olive oil|vegetable oil|canola oil|stock|broth|spice blend|seasoning|extract|vinegar|sugar|flour|cornstarch|baking powder|baking soda)\b/i;

const GARNISH_HINT =
  /\b(cilantro|coriander|parsley|mint|basil|lime wedge|lemon wedge|sesame|green onion|scallion|herb|garnish|chopped)\b/i;

type DishKind =
  | "stew"
  | "rice"
  | "grilled"
  | "salad"
  | "soup"
  | "pasta"
  | "sandwich"
  | "generic";

function normalizeIngredient(raw: string) {
  return raw.replace(/^\d+[\d./]*\s*/, "").replace(/\s+/g, " ").trim();
}

const ARABIC_RICE = /رز|أرز|بخاري|برياني|كبسة|مندي|مجبوس/;
const ARABIC_STEW = /شوربة|حساء|مرق|يخنة|كاري|دال|عدس/;
const ARABIC_GRILLED = /شواء|كباب|مشاوي|ستيك|دجاج مشوي/;
const ARABIC_PASTA = /معكرونة|مكرونة|نودل|سباغيتي/;
const ARABIC_SALAD = /سلطة/;

function classifyDishKind(context: RecipeImagePromptContext): DishKind {
  const raw = [
    context.title ?? "",
    ...(context.tags ?? []),
    ...(context.ingredients ?? []),
    ...(context.steps ?? []).slice(0, 2),
  ].join(" ");

  const blob = raw.toLowerCase();

  if (/\b(rice|biryani|pilaf|fried rice|risotto|paella|bukhari|kabsa|mandi)\b/.test(blob) || ARABIC_RICE.test(raw)) {
    return "rice";
  }
  if (/\b(soup|broth|pho|ramen|stew|curry|dal|lentil|chili|tagine)\b/.test(blob) || ARABIC_STEW.test(raw)) {
    return "stew";
  }
  if (/\b(grill|steak|kebab|skewer|bbq|barbecue|roast chicken|rotisserie)\b/.test(blob) || ARABIC_GRILLED.test(raw)) {
    return "grilled";
  }
  if ((/\b(salad|slaw|bowl)\b/.test(blob) || ARABIC_SALAD.test(raw)) && !/\b(rice|stew|curry)\b/.test(blob) && !ARABIC_RICE.test(raw)) {
    return "salad";
  }
  if (/\b(pasta|noodle|spaghetti|linguine|macaroni|udon|lo mein)\b/.test(blob) || ARABIC_PASTA.test(raw)) {
    return "pasta";
  }
  if (/\b(sandwich|burger|wrap|taco|burrito|banh mi)\b/.test(blob)) return "sandwich";
  if (/\b(soup|bisque|chowder)\b/.test(blob)) return "soup";
  return "generic";
}

function splitIngredients(ingredients: string[]) {
  const cleaned = ingredients.map(normalizeIngredient).filter(Boolean);
  const garnish: string[] = [];
  const base: string[] = [];

  for (const item of cleaned) {
    if (GARNISH_HINT.test(item) && !HIDDEN_INGREDIENT.test(item)) {
      garnish.push(item);
    } else if (!HIDDEN_INGREDIENT.test(item)) {
      base.push(item);
    }
  }

  return {
    base: base.slice(0, 3),
    garnish: garnish.slice(0, 2),
  };
}

function servingVessel(kind: DishKind) {
  switch (kind) {
    case "rice":
      return "on a wide plate";
    case "grilled":
      return "on a dinner plate";
    case "salad":
      return "in a wide shallow bowl";
    case "sandwich":
      return "on a wooden board";
    case "pasta":
      return "in a deep plate";
    case "soup":
    case "stew":
      return "in a shallow bowl";
    default:
      return "on a plate";
  }
}

function cameraAngle(kind: DishKind) {
  if (kind === "rice" || kind === "stew" || kind === "salad") return "Overhead view";
  if (kind === "grilled" || kind === "sandwich") return "Three-quarter angle";
  return "Three-quarter angle";
}

function latinIngredientPhrase(items: string[]) {
  return items.filter((item) => isLatinRecipeText(item));
}

function dishSubject(kind: DishKind, base: string[], dishTitle: string) {
  const latinBase = latinIngredientPhrase(base);
  const main = latinBase[0]?.toLowerCase() ?? "";
  const title = dishTitle.trim();
  const titleAnchor = title && isLatinRecipeText(title) ? `${title}: ` : title ? "" : "";
  if (kind === "stew") {
    if (main.includes("lentil") || /lentil|dal/.test(main)) {
      return "a thick cooked lentil stew with individual tender lentils visible in the sauce";
    }
    return "a thick cooked stew with visible pieces of food in the sauce";
  }
  if (kind === "rice") {
    const mix = latinBase.filter((item) => !/\brice\b/i.test(item));
    if (mix.length) {
      return `${titleAnchor}fluffy cooked rice with distinct grains, ${mix.join(", ")} visible in the rice`;
    }
    if (titleAnchor) {
      return `${titleAnchor}fluffy cooked rice with distinct grains and aromatic spices`;
    }
    return "fluffy cooked rice with distinct grains";
  }
  if (kind === "grilled") {
    return "sliced grilled meat with visible grill marks and juicy interior";
  }
  if (kind === "pasta") {
    return "cooked pasta coated in sauce";
  }
  if (kind === "salad") {
    return "a fresh composed salad";
  }
  if (latinBase.length) {
    return `${titleAnchor}a cooked dish featuring ${latinBase.join(" and ")}`;
  }
  if (titleAnchor) {
    return `${titleAnchor}a freshly cooked plated dish`;
  }
  return "a freshly cooked dish";
}

const FOOD_ONLY_GUARDRAIL =
  "Food only, no people, no faces, no hands, no portraits, no characters, no text overlays.";

function toppingPhrase(garnish: string[]) {
  const latin = latinIngredientPhrase(garnish);
  if (!latin.length) return "";
  if (latin.length === 1) return `, topped with ${latin[0]}`;
  return `, topped with ${latin.slice(0, -1).join(", ")} and ${latin[latin.length - 1]}`;
}

/** Describe finished food from recipe fields — not marketing title, no forced ceramic bowl. */
export function buildRecipeImagePromptFromContext(context: RecipeImagePromptContext) {
  const kind = classifyDishKind(context);
  const { base, garnish } = splitIngredients(context.ingredients ?? []);
  const subject = dishSubject(kind, base, context.title ?? "");
  const vessel = servingVessel(kind);
  const angle = cameraAngle(kind);

  return (
    `Realistic food photograph of ${subject}${toppingPhrase(garnish)}, served ${vessel}. ` +
    `${angle}, soft natural daylight, clear food texture across the dish, natural colors, no text. ` +
    FOOD_ONLY_GUARDRAIL
  );
}
