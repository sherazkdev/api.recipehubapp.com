"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { adminPath } from "@/lib/admin-path";

const tabs = [
  { href: adminPath("/settings/general"), label: "General" },
  { href: adminPath("/settings/ai"), label: "AI" },
  { href: adminPath("/settings/system"), label: "System" },
  { href: adminPath("/settings/password"), label: "Password" },
];

export function SettingsTabsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4">
      <div>
        <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Settings</h1>
        <p className="text-[13px] leading-5 text-[var(--text-muted)]">
          Manage your app settings and preferences.
        </p>
      </div>

      <div className="overflow-x-auto">
        <nav className="flex min-w-max gap-5 border-b border-[var(--border)]">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative pb-3 text-[14px] leading-5 transition-colors",
                  active ? "font-medium text-ink" : "text-[var(--text-muted)] hover:text-ink",
                )}
              >
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--text-primary)]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
