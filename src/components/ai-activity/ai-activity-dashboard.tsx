"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/fields";
import { apiDownload, apiGet, ApiError } from "@/lib/api-client";
import { DashboardCard } from "@/components/charts/dashboard-charts";
import { DashboardChartEmptyState, DashboardChartSkeleton } from "@/components/dashboard/chart-chrome";
import {
  AiActivityDurationChart,
  AiActivityStatusDonut,
  AiActivityTypeDonut,
  AiActivityVolumeChart,
} from "@/components/ai-activity/ai-activity-charts";
import type { AiActivitySummary } from "@/features/ai-activity/services/ai-activity.service";
import type { IconName } from "@/lib/icons";

type Filter = "all" | "generate" | "scan" | "failed";

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "blue",
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone?: "blue" | "purple" | "green" | "red";
}) {
  const toneClass =
    tone === "purple"
      ? "bg-[var(--pastel-purple)]"
      : tone === "green"
        ? "bg-[var(--pastel-green)]"
        : tone === "red"
          ? "bg-[var(--bright-red)]/10"
          : "bg-[var(--pastel-blue)]";

  return (
    <article className="wl-enter rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 md:px-4">
      <span
        className={cn(
          "mb-2 flex size-7 items-center justify-center rounded-full text-[var(--static-black)]",
          toneClass,
        )}
      >
        <Icon name={icon} size={14} />
      </span>
      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

export function AiActivityDashboard() {
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [summary, setSummary] = useState<AiActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  const queryBase = useMemo(() => {
    const query = new URLSearchParams({ from: fromDate, to: toDate });
    if (filter !== "all") query.set("type", filter);
    return query;
  }, [filter, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(queryBase);
      query.set("summary", "1");
      setSummary(await apiGet<AiActivitySummary>(`/api/admin/ai-activity?${query.toString()}`));
    } catch (err) {
      setSummary(null);
      setError(err instanceof ApiError ? err.message : "Failed to load AI activity");
    } finally {
      setLoading(false);
    }
  }, [queryBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasChartData = Boolean(summary?.totals.total);
  const daily = summary?.daily ?? [];

  const chips = [
    { id: "all" as const, label: "All" },
    { id: "generate" as const, label: "Generate" },
    { id: "scan" as const, label: "Scan" },
    { id: "failed" as const, label: "Failed" },
  ];

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">AI Activity</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Usage charts for /api/chat and /api/scan. Export CSV for raw event logs.
          </p>
        </div>
        <SecondaryButton
          type="button"
          onClick={() => {
            const query = new URLSearchParams({ export: "csv", from: fromDate, to: toDate });
            if (filter !== "all") query.set("type", filter);
            void apiDownload(`/api/admin/ai-activity?${query.toString()}`, "ai-activity.csv");
          }}
        >
          <Icon name="download" size={14} />
          Export CSV
        </SecondaryButton>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] leading-5 transition-colors",
                filter === chip.id
                  ? "bg-[var(--text-primary)] text-[var(--page-bg)]"
                  : "border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-ink",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-[13px] text-[var(--text-muted)]">–</span>
          <TextInput
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[var(--bright-red)]/25 bg-[var(--bright-red)]/10 px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-12 gap-3">
        {loading && !summary ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <DashboardChartSkeleton key={index} className="col-span-6 h-[108px] xl:col-span-3" />
            ))}
            <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-8" />
            <DashboardChartSkeleton className="col-span-12 h-[280px] lg:col-span-4" />
            <DashboardChartSkeleton className="col-span-12 h-[240px] lg:col-span-6" />
            <DashboardChartSkeleton className="col-span-12 h-[240px] lg:col-span-6" />
          </>
        ) : (
          <>
            <div className="col-span-6 xl:col-span-3">
              <StatTile
                icon="activity"
                label="Total requests"
                value={String(summary?.totals.total ?? 0)}
                hint={`${summary?.totals.generate ?? 0} generate · ${summary?.totals.scan ?? 0} scan`}
                tone="purple"
              />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <StatTile
                icon="check"
                label="Success rate"
                value={`${summary?.totals.successRate ?? 0}%`}
                hint={`${summary?.totals.success ?? 0} success · ${summary?.totals.failed ?? 0} failed`}
                tone="green"
              />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <StatTile
                icon="clock"
                label="Avg response"
                value={formatDuration(summary?.totals.avgDurationMs ?? 0)}
                hint="Across all events in range"
                tone="blue"
              />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <StatTile
                icon="warning"
                label="Failed events"
                value={String(summary?.totals.failed ?? 0)}
                hint={summary?.totals.failed ? "Use Export CSV for details" : "No failures in range"}
                tone="red"
              />
            </div>

            <DashboardCard title="Requests over time" className="col-span-12 min-h-[280px] lg:col-span-8">
              {hasChartData ? (
                <AiActivityVolumeChart data={daily} />
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="activity" size={18} />}
                  title="No activity yet"
                  description="Run /api/chat or /api/scan to populate this chart."
                />
              )}
            </DashboardCard>

            <DashboardCard title="Request mix" className="col-span-12 min-h-[280px] lg:col-span-4">
              {hasChartData ? (
                <AiActivityTypeDonut generate={summary?.totals.generate ?? 0} scan={summary?.totals.scan ?? 0} />
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="dashboard" size={18} />}
                  title="No mix to show"
                  description="Generate and scan events will appear here."
                />
              )}
            </DashboardCard>

            <DashboardCard title="Avg response time" className="col-span-12 min-h-[240px] lg:col-span-6">
              {hasChartData ? (
                <AiActivityDurationChart data={daily} />
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="clock" size={18} />}
                  title="No timing data"
                  description="Response times are recorded for every AI call."
                />
              )}
            </DashboardCard>

            <DashboardCard title="Success vs failed" className="col-span-12 min-h-[240px] lg:col-span-6">
              {hasChartData ? (
                <AiActivityStatusDonut success={summary?.totals.success ?? 0} failed={summary?.totals.failed ?? 0} />
              ) : (
                <DashboardChartEmptyState
                  icon={<Icon name="check" size={18} />}
                  title="No outcomes yet"
                  description="Successful and failed AI calls are tracked here."
                />
              )}
            </DashboardCard>
          </>
        )}
      </div>
    </div>
  );
}
