"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";
import { NameCell } from "@/components/ui/cells";
import { PrimaryLink } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { apiDelete, apiGet, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

type CuisineRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
};

export default function CuisinesPage() {
  const [rows, setRows] = useState<CuisineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await apiGet<CuisineRow[]>("/api/admin/cuisines"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load cuisines");
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
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">Cuisines</h1>
          <p className="text-[13px] leading-5 text-[var(--text-muted)]">
            Organize recipes into browsable cuisines.
          </p>
        </div>
        <PrimaryLink href={adminPath("/cuisines/new")}>Add Cuisine</PrimaryLink>
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
            title="No cuisines yet"
            description="Create a cuisine so recipes can be grouped."
            action={<PrimaryLink href={adminPath("/cuisines/new")}>Add Cuisine</PrimaryLink>}
          />
        </div>
      ) : (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:p-3">
          <DataTable
            title=""
            resourceLabel="Cuisine"
            rows={rows}
            loading={loading}
            getRowId={(row) => row.id}
            getRowName={(row) => row.name}
            addHref={adminPath("/cuisines/new")}
            addLabel="Add Cuisine"
            showAdd={false}
            showReorder
            onReorder={async (ids) => {
              try {
                await apiPut("/api/admin/cuisines", { reorder: ids });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Failed to save cuisine order");
                await load();
              }
            }}
            searchPlaceholder="Search cuisines"
            editHref={(row) => adminPath(`/cuisines/${row.id}/edit`)}
            onDelete={async (row) => {
              await apiDelete(`/api/admin/cuisines?id=${row.id}`);
              await load();
            }}
            columns={[
              { key: "name", header: "Name", width: "w-[28%]", render: (row) => <NameCell name={row.name} /> },
              { key: "slug", header: "Slug", width: "w-[22%]", render: (row) => <span className="block truncate">{row.slug}</span> },
              {
                key: "description",
                header: "Description",
                width: "w-[50%]",
                hideBelow: "lg",
                render: (row) => <span className="block truncate">{row.description || "—"}</span>,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
