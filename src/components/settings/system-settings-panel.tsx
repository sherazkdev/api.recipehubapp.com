"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiGet, ApiError } from "@/lib/api-client";
import type { IconName } from "@/lib/icons";
import { toneOf, type StatusTone } from "@/shared/utils/status-tone";

type SystemData = {
  status: string;
  timestamp: string;
  environment: string;
  services: {
    database: { status: string; name?: string };
    api: { status: string };
    storage: { status: string; path: string };
  };
  version: string;
};

function StatusDot({ tone }: { tone: StatusTone }) {
  const color =
    tone === "healthy" ? "var(--status-active)" : tone === "failed" ? "var(--bright-red)" : "var(--bright-orange)";
  return <span className="inline-flex size-2 shrink-0 rounded-full" style={{ background: color }} />;
}

function StatusCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  tone: StatusTone;
}) {
  return (
    <article className="rounded-[14px] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-3 md:px-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-ink">
          <Icon name={icon} size={14} />
        </span>
        <StatusDot tone={tone} />
      </div>
      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold leading-7 tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

export function SystemSettingsPanel() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setData(await apiGet<SystemData>("/api/admin/system"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load system status");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[120px] animate-pulse rounded-[14px] bg-[var(--black-05)]" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-2 rounded-[12px] border border-[var(--bright-red)]/25 bg-[var(--bright-red)]/10 px-4 py-3 text-[13px] text-[var(--bright-red)]">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
        <span>{error || "Unavailable"}</span>
      </div>
    );
  }

  const overallTone = toneOf(data.status);
  const apiTone = toneOf(data.services.api.status);
  const dbTone = toneOf(data.services.database.status);
  const storageTone = toneOf(data.services.storage.status);

  return (
    <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[14px] font-semibold leading-5">System status</h2>
        <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
          Last checked: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon="heartbeat"
          label="Overall"
          value={overallTone === "healthy" ? "Operational" : data.status}
          hint={overallTone === "healthy" ? "All services are healthy" : "Some services need attention"}
          tone={overallTone}
        />
        <StatusCard
          icon="broadcast"
          label="API"
          value={apiTone === "healthy" ? "Online" : data.services.api.status}
          hint={apiTone === "healthy" ? "Service is responding" : "API may be degraded"}
          tone={apiTone}
        />
        <StatusCard
          icon="list"
          label="Database"
          value={dbTone === "healthy" ? "Connected" : data.services.database.status}
          hint={
            dbTone === "healthy"
              ? `${data.services.database.name ?? "MongoDB"} connection is healthy`
              : "Database connection issue"
          }
          tone={dbTone}
        />
        <StatusCard
          icon="upload"
          label="Storage"
          value={storageTone === "healthy" ? "Available" : data.services.storage.status}
          hint={storageTone === "healthy" ? "Storage is accessible" : "Storage check failed"}
          tone={storageTone}
        />
      </div>
    </section>
  );
}
