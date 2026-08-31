import { NextRequest, NextResponse } from "next/server";
import { Cuisine } from "@/features/cuisines/models/cuisine.model";
import { RecipeContent } from "@/features/recipes/models/recipe-content.model";
import { Recipe } from "@/features/recipes/models/recipe.model";
import { connectDb } from "@/shared/db/connect";
import { serverError, withAuth } from "@/shared/middleware/auth";

export const maxDuration = 30;

const TEMPLATE = `title,cuisineSlug,slug,prepTime,calories,difficulty,servings,status,description
Creamy Garlic Pasta,italian,creamy-garlic-pasta,15,280,easy,2,draft,Authentic Italian pasta made with fresh garlic and parmesan
`;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (_, req) => {
    try {
      const template = new URL(req.url).searchParams.get("template") === "1";
      if (template) {
        return new NextResponse(TEMPLATE, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="recipes-template.csv"',
            "Cache-Control": "no-store",
          },
        });
      }

      await connectDb();
      const [recipes, cuisines] = await Promise.all([
        Recipe.find()
          .select("slug cuisineId prepTime calories difficulty servings status")
          .sort({ updatedAt: -1 })
          .lean(),
        Cuisine.find().select("_id slug").lean(),
      ]);
      const cuisineSlug = new Map(cuisines.map((item) => [item._id.toString(), item.slug]));
      const contents = await RecipeContent.find({
        recipeId: { $in: recipes.map((recipe) => recipe._id) },
        langCode: "en",
      })
        .select("recipeId title description")
        .lean();
      const contentByRecipe = new Map(contents.map((item) => [item.recipeId.toString(), item]));

      const rows = [
        "title,cuisineSlug,slug,prepTime,calories,difficulty,servings,status,description",
        ...recipes.map((recipe) => {
          const content = contentByRecipe.get(recipe._id.toString());
          return [
            content?.title ?? recipe.slug,
            cuisineSlug.get(recipe.cuisineId.toString()) ?? "",
            recipe.slug,
            recipe.prepTime ?? 0,
            recipe.calories ?? 0,
            recipe.difficulty ?? "easy",
            recipe.servings ?? 1,
            recipe.status ?? "draft",
            content?.description ?? "",
          ]
            .map(csvCell)
            .join(",");
        }),
      ];

      const date = new Date().toISOString().slice(0, 10);
      return new NextResponse(`\uFEFF${rows.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="recipes-export-${date}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("Export recipes error:", error);
      return serverError();
    }
  });
}