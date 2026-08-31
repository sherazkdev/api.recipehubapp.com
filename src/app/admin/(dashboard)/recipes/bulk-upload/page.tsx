"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { FormSection } from "@/components/ui/feedback";
import { FileDrop } from "@/components/ui/file-drop";
import { DataUtilityPage } from "@/components/forms/form-page";
import { Icon } from "@/components/ui/icon";
import { apiPost, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

type BulkResult = {
  matched: number;
  failed: number;
  results: {
    filename: string;
    slug: string;
    matched: boolean;
    path?: string;
    error?: string;
  }[];
};

export default function BulkUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!files.length) {
      setError("Select images first.");
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    try {
      setResult(await apiPost<BulkResult>("/api/admin/recipes/bulk-upload", formData));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bulk upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DataUtilityPage
      title="Bulk Upload"
      subtitle="Name each file by recipe slug, e.g. butter-chicken.jpg"
      actions={
        <>
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
            disabled={!files.length || loading}
            loading={loading}
            loadingLabel="Uploading…"
            onClick={() => void handleUpload()}
          >
            Upload Images
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
        <FormSection title="Images" description="Drop multiple images. Filename must match a recipe slug.">
          <FileDrop
            accept="image/*"
            multiple
            title="Drop images here, or browse"
            hint="Name each file by recipe slug, e.g. butter-chicken.jpg"
            files={files}
            onFiles={setFiles}
          />
        </FormSection>
        {result ? (
          <FormSection title="Result">
            <p className="text-[13px] leading-5">
              Matched {result.matched} · Failed {result.failed}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <thead>
                  <tr className="typo-table-head">
                    <th className="px-3 py-2 text-left font-normal">File</th>
                    <th className="px-3 py-2 text-left font-normal">Slug</th>
                    <th className="px-3 py-2 text-left font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((row) => (
                    <tr key={row.filename} className="typo-table-body border-t border-[var(--border)]">
                      <td className="border-t border-[var(--border)] px-3 py-2">{row.filename}</td>
                      <td className="border-t border-[var(--border)] px-3 py-2">{row.slug}</td>
                      <td className="border-t border-[var(--border)] px-3 py-2">
                        {row.matched ? (
                          <span className="text-[var(--status-active)]">Matched</span>
                        ) : (
                          <span className="text-[var(--bright-red)]">{row.error ?? "Failed"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FormSection>
        ) : null}
      </div>
    </DataUtilityPage>
  );
}
