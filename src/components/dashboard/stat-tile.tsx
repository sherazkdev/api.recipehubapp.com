"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function StatTile({
  href,
  icon,
  label,
  value,
  accent = "blue",
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  accent?: "blue" | "orange" | "green" | "purple";
}) {
  const accents = {
    blue: "bg-[var(--pastel-blue)] text-[var(--accent-blue)]",
    orange: "bg-[var(--pastel-orange)] text-[var(--brand)]",
    green: "bg-[var(--pastel-green)] text-[var(--success)]",
    purple: "bg-[var(--pastel-purple)] text-[var(--accent-purple)]",
  };

  return (
    <Link href={href} className="block min-w-0">
      <article className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-4 transition hover:bg-[var(--surface-hover)]">
        <span
          className={`mb-3 inline-flex size-8 items-center justify-center rounded-full text-[14px] ${accents[accent]}`}
        >
          {icon}
        </span>
        <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-1 text-[24px] font-semibold tracking-tight">{value}</p>
      </article>
    </Link>
  );
}
