"use client";

import { useId, useState } from "react";
import { DashboardChartTooltip } from "@/components/dashboard/chart-chrome";
import { DistributionDonut } from "@/components/dashboard/recharts-charts";
import type { AiActivityDailyPoint } from "@/features/ai-activity/services/ai-activity.service";

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

function shortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AiActivityVolumeChart({ data }: { data: AiActivityDailyPoint[] }) {
  const generateFillId = useId();
  const scanFillId = useId();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const width = 560;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((item) => Math.max(item.generate, item.scan, item.total)), 1);

  const points = data.map((item, index) => {
    const x = pad.left + (data.length === 1 ? innerW / 2 : (index / Math.max(data.length - 1, 1)) * innerW);
    const generateY = pad.top + innerH - (item.generate / max) * innerH;
    const scanY = pad.top + innerH - (item.scan / max) * innerH;
    return { ...item, x, generateY, scanY };
  });

  const generateLine = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.generateY}`)
    .join(" ");
  const scanLine = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.scanY}`).join(" ");
  const generateArea = `${generateLine} L ${points[points.length - 1]?.x ?? pad.left} ${pad.top + innerH} L ${points[0]?.x ?? pad.left} ${pad.top + innerH} Z`;
  const ticks = [0, Math.round(max / 2), max];

  return (
    <div className="relative h-full w-full">
      <ChartTooltipOverlay tooltip={tooltip} />
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] leading-[18px]">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--chart-purple)]" />
          Generate
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--chart-blue)]" />
          Scan
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="presentation">
        <defs>
          <linearGradient id={generateFillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-purple)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--chart-purple)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={scanFillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--chart-blue)" stopOpacity="0" />
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
        <path d={generateArea} fill={`url(#${generateFillId})`} />
        <path d={generateLine} fill="none" stroke="var(--chart-purple)" strokeWidth="2" />
        <path d={scanLine} fill="none" stroke="var(--chart-blue)" strokeWidth="2" strokeDasharray="5 4" />
        {points.map((point) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.generateY}
              r="12"
              fill="transparent"
              onMouseEnter={() =>
                setTooltip({
                  label: shortDate(point.date),
                  rows: [
                    { name: "Generate", value: String(point.generate), color: "var(--chart-purple)" },
                    { name: "Scan", value: String(point.scan), color: "var(--chart-blue)" },
                    { name: "Failed", value: String(point.failed), color: "var(--bright-red)" },
                  ],
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
            <circle cx={point.x} cy={point.generateY} r="3" fill="var(--chart-purple)" />
            <circle cx={point.x} cy={point.scanY} r="3" fill="var(--chart-blue)" />
            <text x={point.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
              {shortDate(point.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AiActivityDurationChart({ data }: { data: AiActivityDailyPoint[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const max = Math.max(...data.map((item) => item.avgDurationMs), 1);

  return (
    <div className="relative flex h-full min-h-[200px] items-end gap-2 px-1 pb-6 pt-2">
      <ChartTooltipOverlay tooltip={tooltip} />
      {data.map((item) => {
        const seconds = (item.avgDurationMs / 1000).toFixed(1);
        return (
          <div
            key={item.date}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            onMouseEnter={() =>
              setTooltip({
                label: shortDate(item.date),
                rows: [
                  { name: "Avg response", value: `${seconds} s`, color: "var(--chart-orange)" },
                  { name: "Requests", value: String(item.total) },
                ],
              })
            }
            onMouseLeave={() => setTooltip(null)}
          >
            <span className="text-[11px] leading-4 text-[var(--text-muted)]">{seconds}s</span>
            <div className="flex h-[140px] w-full items-end justify-center md:h-[168px]">
              <div
                className="w-full max-w-8 rounded-t-[6px] bg-[var(--chart-orange)]"
                style={{
                  height: `${Math.max((item.avgDurationMs / max) * 100, item.avgDurationMs > 0 ? 6 : 0)}%`,
                }}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] leading-4 text-[var(--text-muted)]">
              {shortDate(item.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AiActivityTypeDonut({
  generate,
  scan,
}: {
  generate: number;
  scan: number;
}) {
  return (
    <DistributionDonut
      totalLabel="Total requests"
      data={[
        { label: "Generate", value: generate, color: "var(--chart-purple)" },
        { label: "Scan", value: scan, color: "var(--chart-blue)" },
      ]}
    />
  );
}

export function AiActivityStatusDonut({
  success,
  failed,
}: {
  success: number;
  failed: number;
}) {
  return (
    <DistributionDonut
      totalLabel="Total events"
      data={[
        { label: "Success", value: success, color: "var(--chart-green)" },
        { label: "Failed", value: failed, color: "var(--bright-red)" },
      ]}
    />
  );
}
