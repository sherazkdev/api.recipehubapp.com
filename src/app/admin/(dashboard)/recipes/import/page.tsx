"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { FormSection } from "@/components/ui/feedback";
import { FileDrop } from "@/components/ui/file-drop";
import { DataUtilityPage } from "@/components/forms/form-page";
import { Icon } from "@/components/ui/icon";
import { apiDownload, apiPost, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

export default function CsvImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!file) {
      setError("Select a CSV file first.");
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      setResult(
        await apiPost<{ imported: number; skipped: number; errors: string[] }>(
          "/api/admin/recipes/import",
          formData,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DataUtilityPage
      title="Import CSV"
      subtitle="English columns only: title, cuisineSlug, slug, prepTime, calories, difficulty, servings, status, description. Other languages are translated automatically."
      actions={
        <>
          <SecondaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={loading}
            onClick={() => {
              void apiDownload("/api/admin/recipes/export?template=1", "recipes-template.csv").catch((err) => {
                setError(err instanceof ApiError ? err.message : "Template download failed");
              });
            }}
          >
            Sample CSV
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={loading}
            onClick={() => router.push(adminPath("/recipes"))}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={!file || loading}
            loading={loading}
            loadingLabel="Importing…"
            onClick={() => void handleImport()}
          >
            Import CSV
          </PrimaryButton>
        </>
      }
    >
      {error ? (
        <div className="mb-3 flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
        <FormSection title="Source" description="Drop one CSV file. English columns are enough.">
          <FileDrop
            accept=".csv,text/csv"
            title="Drop a CSV file here, or browse"
            hint="One .csv file · title, cuisineSlug, slug, prepTime, calories…"
            files={file ? [file] : []}
            onFiles={(next) => setFile(next[0] ?? null)}
          />
        </FormSection>
        {result ? (
          <FormSection title="Result">
            <p className="text-[13px] leading-5">
              Imported {result.imported} · Skipped {result.skipped}
            </p>
            {result.errors.length ? (
              <ul className="mt-2 list-disc pl-5 text-[12px] leading-[18px] text-[var(--bright-red)]">
                {result.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </FormSection>
        ) : null}
      </div>
    </DataUtilityPage>
  );
}
