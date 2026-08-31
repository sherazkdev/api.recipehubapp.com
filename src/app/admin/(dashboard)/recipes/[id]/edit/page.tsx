"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RecipeForm, type RecipeDetail } from "@/components/forms/recipe-form";
import { SkeletonState } from "@/components/ui/feedback";
import { apiGet, ApiError } from "@/lib/api-client";

export default function EditRecipePage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<RecipeDetail>(`/api/admin/recipes?id=${params.id}`);
        setRecipe(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load recipe");
      }
    })();
  }, [params.id]);

  if (error) {
    return <p className="text-[13px] text-[var(--bright-red)]">{error}</p>;
  }

  if (!recipe) {
    return <SkeletonState rows={8} />;
  }

  return <RecipeForm mode="edit" recipeId={params.id} initial={recipe} />;
}
