import type { DashboardApiData } from "@/lib/dashboard-api";

const CHART_TONES = [
  "var(--chart-blue)",
  "var(--chart-purple)",
  "var(--chart-orange)",
  "var(--chart-green)",
  "var(--bright-purple)",
];

export function withChartTones<T extends { label: string; value: number; color?: string }>(items: T[]) {
  return items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      ...item,
      color: item.color ?? CHART_TONES[index % CHART_TONES.length],
    }));
}

export function recipesCreatedSeries(trend: DashboardApiData["recipesTrend"]) {
  return trend.map((item) => ({
    date: item.month,
    count: item.current,
    previous: item.previous,
  }));
}

export function hasPreviousTrend(trend: DashboardApiData["recipesTrend"]) {
  return trend.some((item) => item.previous > 0);
}

export function cuisineBars(items: DashboardApiData["recipesByCuisine"]) {
  return [...items]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      category: item.label,
      recipes: item.value,
    }));
}

export function languageBars(items: DashboardApiData["recipesByLanguage"]) {
  return [...items]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((item) => ({
      language: item.label,
      recipes: item.value,
    }));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function statHint(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" · ");
}
