"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/admin/sidebar";
import { TopHeader } from "@/components/admin/top-header";
import { ShellStateProvider } from "@/components/admin/shell-state";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ShellStateProvider>
      <div className="flex h-full min-h-0 overflow-hidden bg-[var(--page-bg)]">
        <Sidebar />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <TopHeader />
          <main className="wl-page-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="flex min-h-full min-w-0 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-5">
              <div className="min-w-0 max-w-full flex-1">{children}</div>
              <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-2 pt-4 text-[12px] leading-[18px] text-[var(--text-muted)]">
                <span>© 2026 Recipe Hub</span>
                <span className="flex gap-4">
                  <span>About</span>
                  <span>Support</span>
                  <span>Contact Us</span>
                </span>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </ShellStateProvider>
  );
}
