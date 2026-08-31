"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/feedback";
import { NameCell } from "@/components/ui/cells";
import { PrimaryLink } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { apiDelete, apiGet, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

type LanguageRow = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isActive: boolean;
};

export default function LanguagesPage() {
  const [rows, setRows] = useState<LanguageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await apiGet<LanguageRow[]>("/api/admin/languages"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load languages");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Languages</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Active languages receive automatic translations from English recipe data.
          </p>
        </div>
        <PrimaryLink href={adminPath("/languages/new")}>Add Language</PrimaryLink>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="min-h-[280px] rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <EmptyState
            title="No languages yet"
            description="Add a language. Existing English recipes will be translated into it."
            action={<PrimaryLink href={adminPath("/languages/new")}>Add Language</PrimaryLink>}
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
          <DataTable
            title=""
            resourceLabel="Language"
            rows={rows}
            loading={loading}
            getRowId={(row) => row.id}
            getRowName={(row) => row.name}
            addHref={adminPath("/languages/new")}
            addLabel="Add Language"
            showAdd={false}
            showReorder
            onReorder={async (ids) => {
              try {
                await apiPut("/api/admin/languages", { reorder: ids });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Failed to save language order");
                await load();
              }
            }}
            searchPlaceholder="Search languages"
            editHref={(row) => adminPath(`/languages/${row.id}/edit`)}
            onDelete={async (row) => {
              if (row.code === "en") throw new Error("English cannot be deleted");
              await apiDelete(`/api/admin/languages?id=${row.id}`);
              await load();
            }}
            columns={[
              { key: "name", header: "Name", width: "w-[28%]", render: (row) => <NameCell name={row.name} /> },
              { key: "code", header: "Code", width: "w-[12%]", render: (row) => row.code },
              {
                key: "nativeName",
                header: "Native",
                width: "w-[22%]",
                hideBelow: "lg",
                render: (row) => <span className="block truncate">{row.nativeName || "—"}</span>,
              },
              {
                key: "flag",
                header: "Flag",
                width: "w-[12%]",
                hideBelow: "xl",
                render: (row) => row.flag || "—",
              },
              { key: "status", header: "Status", width: "w-[16%]", render: (row) => <StatusBadge active={row.isActive} /> },
            ]}
          />
        </div>
      )}
    </div>
  );
}
