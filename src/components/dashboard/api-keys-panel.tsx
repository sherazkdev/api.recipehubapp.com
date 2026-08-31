"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { IconButton, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { ApiError, apiGet } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";
import { relativeTime } from "@/lib/relative-time";
import { DashboardCard } from "@/components/charts/dashboard-charts";
import { DashboardChartEmptyState } from "@/components/dashboard/chart-chrome";
import { Thumb } from "@/components/ui/feedback";
import { useDeferredEffect } from "@/lib/use-deferred-effect";

const PREVIEW_LIMIT = 5;

type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function formatCreated(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DashboardApiKeys() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await apiGet<ApiKeyItem[]>("/api/admin/api-keys");
      setKeys(
        items
          .slice()
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, PREVIEW_LIMIT),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load API keys.");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function copyPrefix(id: string, prefix: string) {
    try {
      await navigator.clipboard.writeText(prefix);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Clipboard copy failed");
    }
  }

  return (
    <DashboardCard
      title="API keys"
      extra={
        <Link
          href={adminPath("/settings/api-keys")}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--bright-purple)] hover:underline"
        >
          View all
          <Icon name="caretRight" size={12} />
        </Link>
      }
    >
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--bright-red)]">
          <span>{error}</span>
          <SecondaryButton type="button" onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-[10px] bg-[var(--black-05)]" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <DashboardChartEmptyState
          icon={<Icon name="password" size={18} />}
          title="No API keys yet"
          description="Generate a key on the API Keys page for Swagger and scripts."
          action={
            <Link
              href={adminPath("/settings/api-keys")}
              className="inline-flex h-8 items-center rounded-[8px] bg-[var(--text-primary)] px-3 text-[13px] text-[var(--page-bg)]"
            >
              Open API Keys
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="relative flex min-w-0 items-center gap-3 rounded-[12px] bg-[var(--page-bg)] px-3 py-2.5"
            >
              <Thumb label={key.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-5">{key.name}</p>
                <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">{key.prefix}••••••••••••</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  Created {formatCreated(key.createdAt)} · {key.lastUsedAt ? relativeTime(key.lastUsedAt) : "Never used"}
                  {key.isActive === false ? " · Revoked" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <IconButton
                  type="button"
                  className="size-8"
                  aria-label="Copy key prefix"
                  title={copied === key.id ? "Copied" : "Copy prefix"}
                  onClick={() => void copyPrefix(key.id, key.prefix)}
                >
                  <Icon name={copied === key.id ? "check" : "copy"} size={14} />
                </IconButton>
                <IconButton
                  type="button"
                  className="size-8"
                  aria-label="More actions"
                  title="More"
                  onClick={() => setMenuId((id) => (id === key.id ? null : key.id))}
                >
                  <Icon name="dots" size={14} />
                </IconButton>
              </div>
              {menuId === key.id ? (
                <div className="absolute right-3 top-11 z-10 min-w-[140px] rounded-[10px] border border-[var(--border)] bg-[var(--modal-bg)] py-1 shadow-[var(--shadow-xs)]">
                  <Link
                    href={adminPath("/settings/api-keys")}
                    className="block px-3 py-1.5 text-[12px] hover:bg-[var(--surface-hover)]"
                    onClick={() => setMenuId(null)}
                  >
                    Manage key
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
