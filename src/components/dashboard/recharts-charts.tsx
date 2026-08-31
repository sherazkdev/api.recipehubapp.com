"use client";

import { useId, useState } from "react";
import { DashboardChartTooltip } from "@/components/dashboard/chart-chrome";
import { pluralize } from "@/lib/dashboard-chart-utils";

type TooltipState = {
  label: string;
  rows: Array<{ name: string; value: string; color?: string }>;
};

function ChartTooltipOverlay({ tooltip }: { tooltip: TooltipState | null }) {
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10">
      <DashboardChartTooltip active={Boolean(tooltip)} label={tooltip?.label} rows={tooltip?.rows} />
    </div>
  );
}

export function RecipesCreatedChart({
  data,
  showPrevious,
}: {
  data: Array<{ date: string; count: number; previous: number }>;
  showPrevious: boolean;
}) {
  const gradientId = useId();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const width = 560;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((item) => Math.max(item.count, showPrevious ? item.previous : 0)), 1);

  const points = data.map((item, index) => {
    const x = pad.left + (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
    const y = pad.top + innerH - (item.count / max) * innerH;
    const prevY = pad.top + innerH - (item.previous / max) * innerH;
    return { ...item, x, y, prevY };
  });

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const prevLine = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.prevY}`).join(" ");
  const area = `${line} L ${points[points.length - 1]?.x ?? pad.left} ${pad.top + innerH} L ${points[0]?.x ?? pad.left} ${pad.top + innerH} Z`;
  const ticks = [0, Math.round(max / 2), max];

  return (
    <div className="relative h-full w-full">
      <ChartTooltipOverlay tooltip={tooltip} />
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = pad.top + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--chart-grid)" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="11">
                {tick}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        {showPrevious ? (
          <path d={prevLine} fill="none" stroke="var(--chart-prev)" strokeWidth="2" strokeDasharray="4 5" />
        ) : null}
        <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth="2" />
        {points.map((point) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r="10"
              fill="transparent"
              onMouseEnter={() =>
                setTooltip({
                  label: point.date,
                  rows: [
                    { name: "Recipes created", value: String(point.count), color: "var(--chart-line)" },
                    ...(showPrevious
                      ? [{ name: "Previous period", value: String(point.previous), color: "var(--chart-prev)" }]
                      : []),
                  ],
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
            <circle cx={point.x} cy={point.y} r="3" fill="var(--chart-line)" />
            <text x={point.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="11">
              {point.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function RecipesByCuisineChart({
  data,
}: {
  data: Array<{ category: string; recipes: number }>;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const max = Math.max(...data.map((item) => item.recipes), 1);
  return (
    <div className="relative flex h-full flex-col justify-center gap-3 py-1">
      <ChartTooltipOverlay tooltip={tooltip} />
      {data.map((item) => (
        <div
          key={item.category}
          className="flex items-center gap-3"
          onMouseEnter={() =>
            setTooltip({
              label: item.category,
              rows: [{ name: "Count", value: pluralize(item.recipes, "recipe") }],
            })
          }
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="w-16 shrink-0 truncate text-[12px] leading-[18px] sm:w-[88px]">{item.category}</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[var(--black-05)]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--chart-purple)]"
              style={{ width: `${Math.max((item.recipes / max) * 100, item.recipes > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] leading-[18px] text-[var(--text-muted)]">
            {item.recipes}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RecipesByLanguageChart({
  data,
}: {
  data: Array<{ language: string; recipes: number }>;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const max = Math.max(...data.map((item) => item.recipes), 1);
  return (
    <div className="relative flex h-full min-h-[200px] items-end gap-2 px-1 pb-6 pt-2">
      <ChartTooltipOverlay tooltip={tooltip} />
      {data.map((item) => (
        <div
          key={item.language}
          className="flex min-w-0 flex-1 flex-col items-center gap-2"
          onMouseEnter={() =>
            setTooltip({
              label: item.language,
              rows: [{ name: "Translations", value: String(item.recipes) }],
            })
          }
          onMouseLeave={() => setTooltip(null)}
        >
          <span className="text-[11px] leading-4 text-[var(--text-muted)]">{item.recipes}</span>
          <div className="flex h-[140px] w-full items-end justify-center md:h-[168px]">
            <div
              className="w-full max-w-8 rounded-t-[6px] bg-[var(--chart-blue)]"
              style={{ height: `${Math.max((item.recipes / max) * 100, item.recipes > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className="w-full truncate text-center text-[11px] leading-4 text-[var(--text-muted)]">
            {item.language}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DistributionDonut({
  data,
  totalLabel = "Total",
}: {
  data: Array<{ label: string; value: number; color: string }>;
  totalLabel?: string;
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = total || 1;
  const radius = 48;
  const stroke = 16;
  const circ = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 5 : 0;
  const usable = circ - gap * data.length;
  const lengths = data.map((item) => (item.value / safeTotal) * usable);
  const slices = data.map((item, index) => {
    const offset = lengths.slice(0, index).reduce((sum, length) => sum + length + gap, 0);
    return { ...item, dash: `${lengths[index]} ${circ - lengths[index]}`, offset };
  });

  return (
    <div className="relative flex h-full min-h-[180px] flex-col items-center gap-3 overflow-hidden sm:flex-row sm:items-center">
      <ChartTooltipOverlay tooltip={tooltip} />
      <svg viewBox="0 0 140 140" className="size-[120px] shrink-0 md:size-[132px]">
        <g transform="rotate(-90 70 70)">
          {slices.map((item) => (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={item.dash}
              strokeDashoffset={-item.offset}
              onMouseEnter={() => {
                const pct = total ? Math.round((item.value / total) * 100) : 0;
                setTooltip({
                  label: item.label,
                  rows: [{ name: "Share", value: `${item.value} (${pct}%)`, color: item.color }],
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </g>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((item) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} className="flex items-center gap-2 text-[12px] leading-[18px]">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="min-w-0 truncate capitalize text-[var(--text-muted)]">{item.label}</span>
              <span className="ml-auto shrink-0">
                {item.value}
                <span className="text-[var(--text-muted)]"> ({pct}%)</span>
              </span>
            </li>
          );
        })}
        <li className="pt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">
          {totalLabel} {total}
        </li>
      </ul>
    </div>
  );
}
