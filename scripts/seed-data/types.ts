export type DemoRecipe = {
  slug: string;
  cuisineSlug: string;
  prepTime: number;
  calories: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  title: string;
  description: string;
  tags: string[];
  chefTips: string[];
  nutrition: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    saturatedFat: number;
    cholesterol: number;
  };
  ingredients: Array<{ name: string; amount: string; unit: string }>;
  steps: Array<{ order: number; title: string; durationMin: number; text: string }>;
};
