import type { ReactNode } from "react";

export function WebsiteBars({
  items,
}: {
  items: { label: string; value: number; emphasis?: boolean }[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="flex h-full flex-col justify-center gap-3 py-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate text-[12px] leading-[18px] sm:w-[88px]">{item.label}</span>
          <div className="relative h-2 flex-1">
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                height: item.emphasis ? 8 : 2,
                background: item.emphasis ? "var(--chart-bar-emphasis)" : "var(--text-primary)",
                opacity: item.emphasis ? 1 : 0.35,
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] leading-[18px] text-[var(--text-muted)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = total || 1;
  const radius = 48;
  const stroke = 16;
  const circ = 2 * Math.PI * radius;
  const gap = items.length > 1 ? 5 : 0;
  const usable = circ - gap * items.length;
  const lengths = items.map((item) => (item.value / safeTotal) * usable);
  const slices = items.map((item, index) => {
    const offset = lengths.slice(0, index).reduce((sum, length) => sum + length + gap, 0);
    return { ...item, dash: `${lengths[index]} ${circ - lengths[index]}`, offset };
  });

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 overflow-hidden sm:flex-row sm:items-center">
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
            />
          ))}
        </g>
      </svg>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label} className="flex items-center gap-2 text-[12px] leading-[18px]">
              <span className="size-1.5 rounded-full" style={{ background: item.color }} />
              <span className="min-w-[56px] capitalize text-[var(--text-muted)]">{item.label}</span>
              <span>
                {item.value}
                <span className="text-[var(--text-muted)]"> · {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DashboardCard({
  title,
  extra,
  children,
  className = "",
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`wl-enter flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-3 md:p-4 ${className}`}
    >
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold leading-5">{title}</h2>
        {extra}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
