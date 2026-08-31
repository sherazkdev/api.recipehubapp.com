"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FormPage } from "@/components/forms/form-page";
import { FormSection } from "@/components/ui/feedback";
import { FormField, NumberInput, Select, Textarea, TextInput } from "@/components/ui/fields";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { ImageUpload } from "@/components/ui/image-upload";
import { Icon } from "@/components/ui/icon";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { cn } from "@/lib/cn";

type CuisineOption = { id: string; name: string };

type Ingredient = { id: string; name: string; amount: string; unit: string };
type Step = { id: string; order: number; title: string; durationMin: number; text: string };
type LangContent = {
  title: string;
  description: string;
  tags: string[];
  chefTips: string[];
  ingredients: Ingredient[];
  steps: Step[];
};

type Nutrition = {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  saturatedFat: number;
  cholesterol: number;
};

export type RecipeDetail = {
  id: string;
  slug: string;
  cuisineId: string;
  imagePath: string;
  prepTime: number;
  calories: number;
  difficulty: string;
  servings: number;
  status: string;
  nutrition: Nutrition;
  contents: (LangContent & { langCode: string })[];
};

const NUTRITION_FIELDS: { key: keyof Nutrition; label: string }[] = [
  { key: "protein", label: "Protein (g)" },
  { key: "carbs", label: "Carbs (g)" },
  { key: "fat", label: "Fat (g)" },
  { key: "fiber", label: "Fiber (g)" },
  { key: "sugar", label: "Sugar (g)" },
  { key: "saturatedFat", label: "Sat. fat (g)" },
  { key: "cholesterol", label: "Cholesterol (mg)" },
  { key: "sodium", label: "Sodium (mg)" },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function reorder<T extends { id: string }>(items: T[], fromId: string, toId: string) {
  if (fromId === toId) return items;
  const next = [...items];
  const from = next.findIndex((item) => item.id === fromId);
  const to = next.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return items;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function DragHandle({
  disabled,
  onDragStart,
  onDragEnd,
}: {
  disabled?: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      aria-label="Drag to reorder"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--text-muted)]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-grab hover:bg-[var(--surface-hover)] hover:text-ink active:cursor-grabbing",
      )}
    >
      <Icon name="grip" size={16} />
    </button>
  );
}

const emptyIngredient = (): Ingredient => ({ id: uid("ing"), name: "", amount: "", unit: "g" });
const emptyStep = (order = 1): Step => ({
  id: uid("step"),
  order,
  title: "",
  durationMin: 0,
  text: "",
});
const emptyContent = (): LangContent => ({
  title: "",
  description: "",
  tags: [],
  chefTips: [],
  ingredients: [emptyIngredient()],
  steps: [emptyStep(1)],
});
const emptyNutrition = (): Nutrition => ({
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  saturatedFat: 0,
  cholesterol: 0,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function contentFromInitial(initial?: RecipeDetail): LangContent {
  const source =
    initial?.contents?.find((item) => item.langCode === "en") ?? initial?.contents?.[0];
  if (!source) return emptyContent();
  return {
    title: source.title,
    description: source.description,
    tags: source.tags ?? [],
    chefTips: source.chefTips ?? [],
    ingredients: source.ingredients?.length
      ? source.ingredients.map((item) => ({ ...item, id: item.id || uid("ing") }))
      : [emptyIngredient()],
    steps: source.steps?.length
      ? source.steps.map((s, i) => ({
          id: s.id || uid("step"),
          order: s.order ?? i + 1,
          title: s.title ?? "",
          durationMin: s.durationMin ?? 0,
          text: s.text,
        }))
      : [emptyStep(1)],
  };
}

export function RecipeForm({
  mode,
  recipeId,
  initial,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  initial?: RecipeDetail;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cuisines, setCuisines] = useState<CuisineOption[]>([]);

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [cuisineId, setCuisineId] = useState(initial?.cuisineId ?? "");
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? "");
  const [prepTime, setPrepTime] = useState(String(initial?.prepTime ?? 15));
  const [calories, setCalories] = useState(String(initial?.calories ?? 0));
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "easy");
  const [servings, setServings] = useState(String(initial?.servings ?? 2));
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [ingredientDrag, setIngredientDrag] = useState<{ id: string; over: string | null }>({
    id: "",
    over: null,
  });
  const [stepDrag, setStepDrag] = useState<{ id: string; over: string | null }>({
    id: "",
    over: null,
  });
  const [nutrition, setNutrition] = useState<Nutrition>(
    initial?.nutrition ? { ...emptyNutrition(), ...initial.nutrition } : emptyNutrition(),
  );
  const [content, setContent] = useState<LangContent>(() => contentFromInitial(initial));

  useEffect(() => {
    void (async () => {
      try {
        const cuisineData = await apiGet<CuisineOption[]>("/api/admin/cuisines");
        setCuisines(cuisineData);
        setCuisineId((current) => current || cuisineData[0]?.id || "");
      } catch {
        setCuisines([]);
      }
    })();
  }, []);

  const updateContent = useCallback((patch: Partial<LangContent>) => {
    setContent((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subdir", "recipes");
      const result = await apiPost<{ path: string; url: string }>("/api/admin/upload", formData);
      setImagePath(result.path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!cuisineId) {
      setError("Cuisine is required");
      return;
    }
    if (!content.title.trim()) {
      setError("English title is required");
      return;
    }

    const finalSlug = slug.trim() || slugify(content.title);
    const payload = {
      slug: finalSlug,
      cuisineId,
      imagePath,
      prepTime: Number(prepTime),
      calories: Number(calories),
      difficulty,
      servings: Number(servings),
      status,
      nutrition,
      content: {
        title: content.title.trim(),
        description: content.description,
        tags: content.tags.filter(Boolean),
        chefTips: content.chefTips.map((t) => t.trim()).filter(Boolean),
        ingredients: content.ingredients
          .filter((i) => i.name.trim())
          .map(({ name, amount, unit }) => ({ name, amount, unit })),
        steps: content.steps
          .filter((s) => s.text.trim())
          .map((s, i) => ({
            order: i + 1,
            title: s.title,
            durationMin: s.durationMin,
            text: s.text,
          })),
      },
    };

    setLoading(true);
    try {
      if (mode === "create") {
        await apiPost("/api/admin/recipes", payload);
      } else if (recipeId) {
        await apiPut("/api/admin/recipes", { id: recipeId, ...payload });
      }
      router.push(adminPath("/recipes"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      title={mode === "create" ? "Add Recipe" : "Edit Recipe"}
      subtitle={
        mode === "create"
          ? "Enter the recipe in English. All dashboard languages are translated automatically."
          : "Edit the English recipe. Translations refresh for every active language on save."
      }
      loadingLabel="Saving and translating…"
      backHref={adminPath("/recipes")}
      backLabel="Back to Recipes"
      submitLabel={mode === "create" ? "Create Recipe" : "Save Changes"}
      fullWidth
      ungrouped
      loading={loading}
      error={error}
      onSubmit={() => handleSubmit()}
    >
      {cuisines.length === 0 ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_203_102/0.35)] bg-[rgb(255_203_102/0.12)] px-4 py-3 text-[13px]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-[var(--bright-orange)]" />
          <p>
            No cuisines found.{" "}
            <a href={adminPath("/cuisines/new")} className="font-medium underline">
              Add a cuisine
            </a>{" "}
            before creating recipes.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
          <FormSection variant="card" title="Photo" description="Hero image shown on the recipe card.">
            <ImageUpload
              compact
              value={imagePath || null}
              uploading={uploading}
              onUrlChange={(url) => setImagePath(url ?? "")}
              onFileSelect={(file) => void handleImageUpload(file)}
            />
          </FormSection>

          <FormSection variant="card" title="Details" description="Visibility, cuisine, and serving facts.">
            <FormField label="Cuisine" required>
              <Select value={cuisineId} onChange={(event) => setCuisineId(event.target.value)}>
                <option value="">Select cuisine</option>
                {cuisines.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </FormField>
            <FormField label="Difficulty">
              <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prep (min)">
                <NumberInput value={prepTime} onChange={(event) => setPrepTime(event.target.value)} />
              </FormField>
              <FormField label="Servings">
                <NumberInput value={servings} min={1} onChange={(event) => setServings(event.target.value)} />
              </FormField>
              <FormField label="Calories" className="col-span-2">
                <NumberInput value={calories} onChange={(event) => setCalories(event.target.value)} />
              </FormField>
            </div>
          </FormSection>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <FormSection variant="card" title="Recipe" description="English title and summary. Other languages are translated on save.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Title" required>
                <TextInput
                  value={content.title}
                  onChange={(event) => {
                    updateContent({ title: event.target.value });
                    if (mode === "create" && !slug) setSlug(slugify(event.target.value));
                  }}
                />
              </FormField>
              <FormField label="Slug" hint="Auto-generated from title if empty">
                <TextInput
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="creamy-garlic-pasta"
                />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea
                value={content.description}
                onChange={(event) => updateContent({ description: event.target.value })}
              />
            </FormField>
            <FormField label="Tags" hint="Comma separated">
              <TextInput
                value={content.tags.join(", ")}
                onChange={(event) =>
                  updateContent({
                    tags: event.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </FormField>
          </FormSection>

          <FormSection variant="card" title="Ingredients" description="Drag rows to reorder. Empty rows are ignored on save.">
            <div className="flex flex-col gap-2">
              <div className="hidden items-center gap-2 px-2 text-[12px] leading-[18px] text-[var(--text-muted)] sm:grid sm:grid-cols-[32px_minmax(0,1fr)_5.5rem_5.5rem_32px]">
                <span />
                <span>Name</span>
                <span>Qty</span>
                <span>Unit</span>
                <span />
              </div>
              {content.ingredients.map((ingredient) => (
                <div
                  key={ingredient.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIngredientDrag((current) => ({ ...current, over: ingredient.id }));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (ingredientDrag.id) {
                      updateContent({
                        ingredients: reorder(content.ingredients, ingredientDrag.id, ingredient.id),
                      });
                    }
                    setIngredientDrag({ id: "", over: null });
                  }}
                  className={cn(
                    "grid grid-cols-1 items-start gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-[32px_minmax(0,1fr)_5.5rem_5.5rem_32px] sm:items-center sm:p-2",
                    ingredientDrag.id === ingredient.id && "opacity-50",
                    ingredientDrag.over === ingredient.id &&
                      ingredientDrag.id &&
                      ingredientDrag.id !== ingredient.id &&
                      "bg-[var(--nav-hover-bg)]",
                  )}
                >
                  <div className="flex items-center justify-between sm:contents">
                    <DragHandle
                      onDragStart={(event) => {
                        setIngredientDrag({ id: ingredient.id, over: null });
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", ingredient.id);
                      }}
                      onDragEnd={() => setIngredientDrag({ id: "", over: null })}
                    />
                    <IconButton
                      type="button"
                      className="sm:order-last"
                      aria-label="Remove ingredient"
                      onClick={() => {
                        const next = content.ingredients.filter((item) => item.id !== ingredient.id);
                        updateContent({ ingredients: next.length ? next : [emptyIngredient()] });
                      }}
                    >
                      <Icon name="minus" size={14} />
                    </IconButton>
                  </div>
                  <FormField label="Name" className="min-w-0 sm:[&>span:first-child]:hidden">
                    <TextInput
                      value={ingredient.name}
                      placeholder="Flour"
                      onChange={(event) =>
                        updateContent({
                          ingredients: content.ingredients.map((item) =>
                            item.id === ingredient.id ? { ...item, name: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <FormField label="Qty" className="min-w-0 sm:[&>span:first-child]:hidden">
                      <TextInput
                        value={ingredient.amount}
                        placeholder="200"
                        onChange={(event) =>
                          updateContent({
                            ingredients: content.ingredients.map((item) =>
                              item.id === ingredient.id ? { ...item, amount: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Unit" className="min-w-0 sm:[&>span:first-child]:hidden">
                      <TextInput
                        value={ingredient.unit}
                        placeholder="g"
                        onChange={(event) =>
                          updateContent({
                            ingredients: content.ingredients.map((item) =>
                              item.id === ingredient.id ? { ...item, unit: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </FormField>
                  </div>
                </div>
              ))}
              <SecondaryButton
                type="button"
                className="self-start"
                onClick={() =>
                  updateContent({
                    ingredients: [...content.ingredients, emptyIngredient()],
                  })
                }
              >
                Add Ingredient
              </SecondaryButton>
            </div>
          </FormSection>

          <FormSection variant="card" title="Instructions" description="Steps are renumbered automatically after reorder.">
            <div className="flex flex-col gap-3">
              {content.steps.map((step, index) => (
                <div
                  key={step.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setStepDrag((current) => ({ ...current, over: step.id }));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (stepDrag.id) {
                      updateContent({
                        steps: reorder(content.steps, stepDrag.id, step.id).map((item, itemIndex) => ({
                          ...item,
                          order: itemIndex + 1,
                        })),
                      });
                    }
                    setStepDrag({ id: "", over: null });
                  }}
                  className={cn(
                    "rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3",
                    stepDrag.id === step.id && "opacity-50",
                    stepDrag.over === step.id &&
                      stepDrag.id &&
                      stepDrag.id !== step.id &&
                      "bg-[var(--nav-hover-bg)]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <DragHandle
                      onDragStart={(event) => {
                        setStepDrag({ id: step.id, over: null });
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", step.id);
                      }}
                      onDragEnd={() => setStepDrag({ id: "", over: null })}
                    />
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--pastel-purple)] text-[12px] font-semibold text-[var(--static-black)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem]">
                        <FormField label="Title">
                          <TextInput
                            value={step.title}
                            placeholder="Sauté the onions"
                            onChange={(event) =>
                              updateContent({
                                steps: content.steps.map((item) =>
                                  item.id === step.id ? { ...item, title: event.target.value } : item,
                                ),
                              })
                            }
                          />
                        </FormField>
                        <FormField label="Minutes">
                          <NumberInput
                            min={0}
                            value={step.durationMin}
                            onChange={(event) =>
                              updateContent({
                                steps: content.steps.map((item) =>
                                  item.id === step.id
                                    ? { ...item, durationMin: Number(event.target.value) || 0 }
                                    : item,
                                ),
                              })
                            }
                          />
                        </FormField>
                      </div>
                      <FormField label="Instruction" className="mt-2">
                        <Textarea
                          value={step.text}
                          placeholder="Describe what to do in this step."
                          onChange={(event) =>
                            updateContent({
                              steps: content.steps.map((item) =>
                                item.id === step.id ? { ...item, text: event.target.value } : item,
                              ),
                            })
                          }
                        />
                      </FormField>
                    </div>
                    <IconButton
                      type="button"
                      aria-label="Remove step"
                      onClick={() => {
                        const next = content.steps
                          .filter((item) => item.id !== step.id)
                          .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
                        updateContent({ steps: next.length ? next : [emptyStep(1)] });
                      }}
                    >
                      <Icon name="minus" size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
              <SecondaryButton
                type="button"
                className="self-start"
                onClick={() =>
                  updateContent({
                    steps: [...content.steps, emptyStep(content.steps.length + 1)],
                  })
                }
              >
                Add Step
              </SecondaryButton>
            </div>
          </FormSection>

          <FormSection variant="card" title="Chef tips" description="One tip per line. Empty lines are ignored on save.">
            <FormField>
              <Textarea
                value={content.chefTips.join("\n")}
                placeholder="Toast the bread just before serving."
                onChange={(event) => updateContent({ chefTips: event.target.value.split("\n") })}
              />
            </FormField>
          </FormSection>

          <FormSection variant="card" title="Nutrition" description="Per-serving values. Calories are set in Details.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NUTRITION_FIELDS.map((field) => (
                <FormField key={field.key} label={field.label}>
                  <NumberInput
                    min={0}
                    value={nutrition[field.key]}
                    onChange={(event) =>
                      setNutrition((prev) => ({
                        ...prev,
                        [field.key]: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </FormField>
              ))}
            </div>
          </FormSection>
        </div>
      </div>
    </FormPage>
  );
}
