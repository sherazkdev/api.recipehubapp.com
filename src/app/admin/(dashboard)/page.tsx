"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { DashboardCard } from "@/components/charts/dashboard-charts";
import { DashboardChartEmptyState, DashboardChartSkeleton } from "@/components/dashboard/chart-chrome";
import { DashboardApiKeys } from "@/components/dashboard/api-keys-panel";
import {
  DistributionDonut,
  RecipesByCuisineChart,
  RecipesByLanguageChart,
  RecipesCreatedChart,
} from "@/components/dashboard/recharts-charts";
import { SecondaryButton } from "@/components/ui/buttons";
import { Thumb } from "@/components/ui/feedback";
import { StatusDot } from "@/components/ui/badges";
import { ApiError } from "@/lib/api-client";
import { fetchDashboard, formatStatValue, type DashboardApiData } from "@/lib/dashboard-api";
import { adminPath } from "@/lib/admin-path";
import { relativeTime } from "@/lib/relative-time";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import type { IconName } from "@/lib/icons";
import {
  cuisineBars,
  hasPreviousTrend,
  languageBars,
  recipesCreatedSeries,
  statHint,
  withChartTones,
} from "@/lib/dashboard-chart-utils";

function AddLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--text-primary)] px-3 text-[13px] text-[var(--page-bg)]"
    >
      <Icon name="plus" size={14} />
      {children}
    </Link>
  );
}

function StatTile({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block min-w-0">
      <article className="wl-enter rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 transition-colors duration-150 hover:bg-[var(--surface-hover)] md:px-4">
        <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name={icon} size={14} />
        </span>
        <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight">{value}</p>
        <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{hint}</p>
      </article>
    </Link>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardApiData | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchDashboard());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    void load();
  }, []);

  const recipesSeries = useMemo(() => (data ? recipesCreatedSeries(data.recipesTrend) : []), [data]);
  const cuisineData = useMemo(() => (data ? cuisineBars(data.recipesByCuisine) : []), [data]);
  const languageData = useMemo(() => (data ? languageBars(data.recipesByLanguage) : []), [data]);
  const statusItems = useMemo(() => (data ? withChartTones(data.recipesByStatus) : []), [data]);
  const difficultyItems = useMemo(() => (data ? withChartTones(data.recipesByDifficulty) : []), [data]);
  const showPrevious = data ? hasPreviousTrend(data.recipesTrend) : false;
  const cuisineHasRecipes = cuisineData.some((item) => item.recipes > 0);
  const languageHasContent = languageData.some((item) => item.recipes > 0);

  if (loading && !data) {
    return (
      <div className="grid min-w-0 max-w-full grid-cols-12 gap-3 pb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardChartSkeleton key={index} className="col-span-6 h-[108px] xl:col-span-3" />
        ))}
        <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[240px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[220px] sm:col-span-6 lg:col-span-3" />
        <DashboardChartSkeleton className="col-span-12 h-[220px] sm:col-span-6 lg:col-span-3" />
        <DashboardChartSkeleton className="col-span-12 h-[220px] lg:col-span-6" />
        <DashboardChartSkeleton className="col-span-12 h-[160px]" />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 max-w-full grid-cols-12 gap-3 pb-6">
      {error ? (
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <span className="inline-flex items-start gap-2">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            {error}
          </span>
          <SecondaryButton type="button" onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/recipes")}
              icon="recipe"
              label="Total Recipes"
              value={formatStatValue(data.stats.recipes)}
              hint={statHint([
                `${formatStatValue(data.stats.published)} published`,
                `${formatStatValue(data.stats.draft)} draft`,
                data.stats.archived ? `${formatStatValue(data.stats.archived)} archived` : "",
              ])}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/cuisines")}
              icon="cuisine"
              label="Cuisines"
              value={formatStatValue(data.stats.cuisines)}
              hint={`${formatStatValue(data.stats.cuisinesWithRecipes)} with recipes`}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/languages")}
              icon="language"
              label="Languages"
              value={formatStatValue(data.stats.languages)}
              hint={statHint([
                `${formatStatValue(data.stats.activeLanguages)} active`,
                `${formatStatValue(data.stats.languagesWithContent)} with translations`,
              ])}
            />
          </div>
          <div className="col-span-6 xl:col-span-3">
            <StatTile
              href={adminPath("/settings/api-keys")}
              icon="password"
              label="Active API Keys"
              value={formatStatValue(data.stats.apiKeys)}
              hint={statHint([
                data.stats.apiKeysRevoked ? `${formatStatValue(data.stats.apiKeysRevoked)} revoked` : "",
                data.stats.apiKeysUsed ? `${formatStatValue(data.stats.apiKeysUsed)} used` : "None used yet",
              ])}
            />
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard
              title="Recipes created"
              extra={
                <span className="text-[12px] text-[var(--text-muted)]">
                  {data.stats.createdThisMonth
                    ? `${formatStatValue(data.stats.createdThisMonth)} this month`
                    : "Last 6 months"}
                </span>
              }
            >
              {data.stats.recipes > 0 && recipesSeries.length > 0 ? (
                <div className="h-[220px] md:h-[260px]" role="img" aria-label="Recipes created over the last 6 months">
                  <RecipesCreatedChart data={recipesSeries} showPrevious={showPrevious} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="recipe" size={18} />}
                  title="No recipe activity yet"
                  description="Create your first recipe to start seeing creation activity."
                  action={<AddLink href={adminPath("/recipes/new")}>Add Recipe</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard
              title="Recipes by cuisine"
              extra={
                <Link
                  href={adminPath("/cuisines")}
                  className="text-[12px] text-[var(--bright-purple)] hover:underline"
                >
                  View all
                </Link>
              }
            >
              {cuisineHasRecipes ? (
                <div className="min-h-[220px] md:min-h-[260px]">
                  <RecipesByCuisineChart data={cuisineData} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="cuisine" size={18} />}
                  title="No cuisine split yet"
                  description="Assign recipes to cuisines to see this chart."
                  action={<AddLink href={adminPath("/recipes/new")}>Add Recipe</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <DashboardCard
              title="Language coverage"
              extra={
                <Link
                  href={adminPath("/languages")}
                  className="text-[12px] text-[var(--bright-purple)] hover:underline"
                >
                  View all
                </Link>
              }
            >
              {languageHasContent ? (
                <div className="h-[220px] md:h-[260px]" role="img" aria-label="Recipe translations by language">
                  <RecipesByLanguageChart data={languageData} />
                </div>
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="language" size={18} />}
                  title="No translations yet"
                  description="Add recipe content in a language to see coverage."
                  action={<AddLink href={adminPath("/recipes/new")}>Add Recipe</AddLink>}
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <DashboardCard title="By status">
              {statusItems.length > 0 ? (
                <DistributionDonut data={statusItems} totalLabel="Recipes" />
              ) : (
                <DashboardChartEmptyState
                  title="No status data"
                  description="Publish or draft a recipe to see this split."
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12 sm:col-span-6 lg:col-span-3">
            <DashboardCard title="By difficulty">
              {difficultyItems.length > 0 ? (
                <DistributionDonut data={difficultyItems} totalLabel="Recipes" />
              ) : (
                <DashboardChartEmptyState
                  title="No difficulty data"
                  description="Difficulty split appears after recipes are saved."
                />
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12">
            <DashboardCard
              title="Recent recipes"
              extra={
                <Link
                  href={adminPath("/recipes")}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--bright-purple)] hover:underline"
                >
                  View all
                  <Icon name="caretRight" size={12} />
                </Link>
              }
            >
              {data.recentRecipes.length === 0 ? (
                <DashboardChartEmptyState
                  title="No recipes yet"
                  description="Create your first recipe to see recent activity."
                  action={<AddLink href={adminPath("/recipes/new")}>Add Recipe</AddLink>}
                />
              ) : (
                <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[520px] table-fixed">
                  <thead>
                    <tr className="typo-table-head">
                      <th className="w-[42%] px-2 py-2 text-left font-normal">Recipe</th>
                      <th className="hidden w-[22%] px-2 py-2 text-left font-normal md:table-cell">Cuisine</th>
                      <th className="hidden w-[16%] px-2 py-2 text-left font-normal sm:table-cell">Status</th>
                      <th className="w-[20%] px-2 py-2 text-right font-normal">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRecipes.map((item) => (
                      <tr key={item.id} className="typo-table-body border-t border-[var(--border)]">
                        <td className="min-w-0 overflow-hidden px-2 py-2.5">
                          <Link
                            href={adminPath(`/recipes/${item.id}/edit`)}
                            className="flex min-w-0 items-center gap-2 hover:underline"
                          >
                            <Thumb label={item.title} />
                            <span className="min-w-0">
                              <span className="block truncate">{item.title}</span>
                              <span className="block truncate text-[11px] text-[var(--text-muted)]">
                                {item.slug}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden min-w-0 overflow-hidden px-2 py-2.5 text-[var(--text-muted)] md:table-cell">
                          <span className="block truncate">{item.cuisine}</span>
                        </td>
                        <td className="hidden px-2 py-2.5 sm:table-cell">
                          <StatusDot status={item.status} />
                        </td>
                        <td className="px-2 py-2.5 text-right text-[var(--text-muted)]">
                          {item.updatedAt ? relativeTime(item.updatedAt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </DashboardCard>
          </div>

          <div className="col-span-12">
            <DashboardApiKeys />
          </div>
        </>
      ) : null}
    </div>
  );
}
