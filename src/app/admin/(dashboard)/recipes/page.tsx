"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { DifficultyBadge, StatusDot } from "@/components/ui/badges";
import { EmptyState, StatCard, Thumb } from "@/components/ui/feedback";
import { PrimaryLink, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { apiDelete, apiDownload, apiGet, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { recipeImageSrc } from "@/lib/media-url";

type RecipeRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  difficulty: string;
  prepTime: number;
  calories: number;
  imagePath?: string;
  imageUrl?: string;
  updatedAt?: string;
};

function RecipeNameCell({ recipe }: { recipe: RecipeRow }) {
  const src = recipeImageSrc(recipe);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {src ? (
        <span className="relative size-10 shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="size-full object-cover" />
        </span>
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--black-05)]">
          <Thumb label={recipe.title} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-5">{recipe.title}</p>
        <p className="truncate text-[12px] leading-[18px] text-[var(--text-muted)]">{recipe.slug}</p>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[12px] leading-[18px] transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--page-bg)]"
          : "bg-[var(--black-05)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
      )}
    >
      {label}
    </button>
  );
}

export default function RecipesPage() {
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      setRows(await apiGet<RecipeRow[]>(`/api/admin/recipes${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load recipes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const published = rows.filter((row) => row.status === "published").length;
    const draft = rows.filter((row) => row.status === "draft").length;
    return { total: rows.length, published, draft };
  }, [rows]);

  const hasFilters = statusFilter !== "all";

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Recipes</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Manage recipes, nutrition, and publishing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            disabled={exporting || loading}
            onClick={() => {
              setExporting(true);
              void apiDownload(
                "/api/admin/recipes/export",
                `recipes-export-${new Date().toISOString().slice(0, 10)}.csv`,
              )
                .catch((err) => {
                  setError(err instanceof ApiError ? err.message : "Export failed");
                })
                .finally(() => setExporting(false));
            }}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </SecondaryButton>
          <PrimaryLink href={adminPath("/recipes/new")}>Add Recipe</PrimaryLink>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total recipes" value={stats.total} hint="In current filter view" />
        <StatCard label="Published" value={stats.published} tone="green" hint="Visible to users" />
        <StatCard label="Draft" value={stats.draft} tone="orange" hint="Not published yet" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5">
        <span className="mr-1 text-[12px] text-[var(--text-muted)]">Quick filters</span>
        <FilterChip label="All statuses" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <FilterChip label="Published" active={statusFilter === "published"} onClick={() => setStatusFilter("published")} />
        <FilterChip label="Draft" active={statusFilter === "draft"} onClick={() => setStatusFilter("draft")} />
        <FilterChip label="Archived" active={statusFilter === "archived"} onClick={() => setStatusFilter("archived")} />
        {hasFilters ? (
          <button
            type="button"
            className="ml-auto text-[12px] text-[var(--bright-purple)] hover:underline"
            onClick={() => setStatusFilter("all")}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="min-h-[280px] rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <EmptyState
            title={hasFilters ? "No recipes match filters" : "No recipes yet"}
            description={
              hasFilters
                ? "Clear filters to see all saved recipes."
                : "Create your first recipe or import from CSV."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {hasFilters ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[14px] hover:bg-[var(--surface-hover)]"
                    onClick={() => setStatusFilter("all")}
                  >
                    Clear filters
                  </button>
                ) : (
                  <PrimaryLink href={adminPath("/recipes/new")}>Add Recipe</PrimaryLink>
                )}
                {!hasFilters ? (
                  <Link
                    href={adminPath("/recipes/import")}
                    className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[14px] hover:bg-[var(--surface-hover)]"
                  >
                    Import CSV
                  </Link>
                ) : null}
              </div>
            }
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
          <DataTable
            title=""
            resourceLabel="Recipe"
            rows={rows}
            loading={loading}
            getRowId={(row) => row.id}
            getRowName={(row) => row.title}
            addHref={adminPath("/recipes/new")}
            addLabel="Add Recipe"
            showAdd={false}
            showReorder={statusFilter === "all"}
            onReorder={async (ids) => {
              try {
                await apiPut("/api/admin/recipes", { reorder: ids });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Failed to save recipe order");
                await load();
              }
            }}
            searchPlaceholder="Search recipes"
            editHref={(row) => adminPath(`/recipes/${row.id}/edit`)}
            onDelete={async (row) => {
              await apiDelete(`/api/admin/recipes?id=${row.id}`);
              await load();
            }}
            filters={[
              {
                key: "status",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                  { value: "archived", label: "Archived" },
                ],
              },
            ]}
            columns={[
              {
                key: "title",
                header: "Recipe",
                width: "w-[38%]",
                render: (row) => <RecipeNameCell recipe={row} />,
              },
              {
                key: "status",
                header: "Status",
                width: "w-[14%]",
                render: (row) => <StatusDot status={row.status} />,
              },
              {
                key: "difficulty",
                header: "Difficulty",
                width: "w-[16%]",
                hideBelow: "lg",
                render: (row) => <DifficultyBadge difficulty={row.difficulty} />,
              },
              {
                key: "prepTime",
                header: "Prep",
                width: "w-[12%]",
                hideBelow: "lg",
                render: (row) => `${row.prepTime} min`,
              },
              {
                key: "calories",
                header: "Calories",
                width: "w-[14%]",
                hideBelow: "xl",
                render: (row) => (
                  <span className="inline-flex items-center gap-1 text-[12px]">
                    <Icon name="heartbeat" size={12} className="text-[var(--bright-red)]" />
                    {row.calories}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
