"use client";

import { usePathname } from "next/navigation";
import { SettingsTabsShell } from "@/components/settings/settings-tabs-shell";
import { adminPath } from "@/lib/admin-path";

const HUB_PATHS = [
  adminPath("/settings/general"),
  adminPath("/settings/ai"),
  adminPath("/settings/system"),
  adminPath("/settings/password"),
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inHub = HUB_PATHS.includes(pathname);

  if (!inHub) return children;
  return <SettingsTabsShell>{children}</SettingsTabsShell>;
}
