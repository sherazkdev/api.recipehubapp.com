import { cn } from "@/lib/cn";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px]">
      <span
        className="size-1.5 rounded-full"
        style={{ background: active ? "var(--status-active)" : "var(--status-inactive)" }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "published" || status === "active"
      ? "var(--status-active)"
      : status === "draft"
        ? "var(--bright-orange)"
        : "var(--text-muted)";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px] capitalize">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty?: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    easy: { label: "Easy", color: "var(--status-easy)" },
    medium: { label: "Medium", color: "var(--status-medium)" },
    hard: { label: "Hard", color: "var(--status-hard)" },
  };
  const item = map[String(difficulty ?? "medium").toLowerCase()] ?? map.medium;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px] capitalize">
      <span className="size-1.5 rounded-full" style={{ background: item.color }} />
      {item.label}
    </span>
  );
}

export function Pill({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-[var(--black-05)] px-2 text-[12px] leading-[18px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
