"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiGet, ApiError } from "@/lib/api-client";
import type { IconName } from "@/lib/icons";

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

function StatusDot({ tone }: { tone: "healthy" | "failed" | "warning" }) {
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
  tone: "healthy" | "failed" | "warning";
}) {
  return (
    <article className="rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 md:px-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
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

function toneOf(status: string): "healthy" | "failed" | "warning" {
  if (status === "healthy" || status === "ok" || status === "up") return "healthy";
  if (status === "down" || status === "failed" || status === "error") return "failed";
  return "warning";
}

export default function SystemStatusPage() {
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
          <div key={index} className="h-[108px] animate-pulse rounded-[14px] bg-[var(--black-05)]" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
        <span>{error || "Unavailable"}</span>
      </div>
    );
  }

  const overall = toneOf(data.status);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-[18px] font-semibold leading-7 tracking-tight">System Status</h1>
        <p className="text-[13px] leading-5 text-[var(--text-muted)]">
          Last checked {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon="heartbeat"
          label="Overall"
          value={data.status}
          hint={`${data.environment} · v${data.version}`}
          tone={overall}
        />
        <StatusCard
          icon="dashboard"
          label="API"
          value={data.services.api.status}
          hint="Admin and public routes"
          tone={toneOf(data.services.api.status)}
        />
        <StatusCard
          icon="list"
          label="Database"
          value={data.services.database.status}
          hint={data.services.database.name ?? "MongoDB"}
          tone={toneOf(data.services.database.status)}
        />
        <StatusCard
          icon="upload"
          label="Storage"
          value={data.services.storage.status}
          hint={data.services.storage.path}
          tone={toneOf(data.services.storage.status)}
        />
      </div>
    </div>
  );
}
