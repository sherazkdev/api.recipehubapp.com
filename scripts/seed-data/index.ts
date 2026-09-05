import type { DemoRecipe } from "./types";
import { americanRecipes } from "./american";
import { chineseRecipes } from "./chinese";
import { frenchRecipes } from "./french";
import { indianRecipes } from "./indian";
import { italianRecipes } from "./italian";
import { japaneseRecipes } from "./japanese";
import { koreanRecipes } from "./korean";
import { mediterraneanRecipes } from "./mediterranean";
import { mexicanRecipes } from "./mexican";
import { middleEasternRecipes } from "./middle-eastern";
import { thaiRecipes } from "./thai";
import { vietnameseRecipes } from "./vietnamese";

export type { DemoRecipe } from "./types";

const legacyRecipes: DemoRecipe[] = [
  {
    slug: "garlic-bread",
    cuisineSlug: "italian",
    prepTime: 20,
    calories: 280,
    difficulty: "easy",
    servings: 4,
    title: "Garlic Bread",
    description: "Crispy baked bread with garlic butter and herbs.",
    tags: ["bread", "side", "italian"],
    chefTips: ["Serve hot from the oven."],
    nutrition: {
      protein: 6,
      carbs: 28,
      fat: 16,
      fiber: 1,
      sugar: 2,
      sodium: 420,
      saturatedFat: 9,
      cholesterol: 35,
    },
    ingredients: [
      { name: "Bread", amount: "1", unit: "loaf" },
      { name: "Garlic", amount: "4", unit: "cloves" },
      { name: "Butter", amount: "50", unit: "g" },
    ],
    steps: [
      { order: 1, title: "Prepare", durationMin: 8, text: "Mix soft butter with chopped garlic." },
      { order: 2, title: "Bake", durationMin: 12, text: "Spread on bread and bake until golden." },
    ],
  },
  {
    slug: "spicy-chicken-curry",
    cuisineSlug: "indian",
    prepTime: 45,
    calories: 420,
    difficulty: "medium",
    servings: 4,
    title: "Spicy Chicken Curry",
    description: "A warm Indian curry with tender chicken and aromatic spices.",
    tags: ["chicken", "curry", "dinner"],
    chefTips: ["Rest the curry for ten minutes before serving."],
    nutrition: {
      protein: 32,
      carbs: 12,
      fat: 26,
      fiber: 3,
      sugar: 5,
      sodium: 680,
      saturatedFat: 8,
      cholesterol: 110,
    },
    ingredients: [
      { name: "Chicken", amount: "500", unit: "g" },
      { name: "Onion", amount: "2", unit: "pcs" },
      { name: "Tomato", amount: "2", unit: "pcs" },
    ],
    steps: [
      {
        order: 1,
        title: "Cook the base",
        durationMin: 15,
        text: "Fry onion until golden, then add spices and tomato.",
      },
      { order: 2, title: "Simmer", durationMin: 25, text: "Add chicken and simmer until cooked through." },
    ],
  },
];

export const demoRecipes: DemoRecipe[] = [
  ...legacyRecipes,
  ...italianRecipes,
  ...indianRecipes,
  ...chineseRecipes,
  ...mexicanRecipes,
  ...thaiRecipes,
  ...japaneseRecipes,
  ...mediterraneanRecipes,
  ...koreanRecipes,
  ...frenchRecipes,
  ...americanRecipes,
  ...middleEasternRecipes,
  ...vietnameseRecipes,
];
