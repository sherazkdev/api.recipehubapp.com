"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormPage } from "@/components/forms/form-page";
import { FormSection } from "@/components/ui/feedback";
import { FormField, Textarea, TextInput } from "@/components/ui/fields";
import { apiPost, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

type CuisineInitial = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imagePath?: string;
};

export function CuisineForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: CuisineInitial;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = { name: name.trim(), slug: slug.trim() || undefined, description };
      if (mode === "create") {
        await apiPost("/api/admin/cuisines", payload);
      } else if (initial?.id) {
        await apiPut("/api/admin/cuisines", { id: initial.id, ...payload });
      }
      router.push(adminPath("/cuisines"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save cuisine");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      title={mode === "create" ? "Add Cuisine" : "Edit Cuisine"}
      subtitle={mode === "create" ? "Name a cuisine recipes can belong to." : "Update cuisine details."}
      backHref={adminPath("/cuisines")}
      backLabel="Back to Cuisines"
      submitLabel={mode === "create" ? "Create Cuisine" : "Save Changes"}
      ungrouped
      loading={loading}
      error={error}
      onSubmit={() => handleSubmit()}
    >
      <FormSection variant="card" title="Cuisine" description="Name, slug, and a short description.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" required>
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label="Slug" hint="Leave empty to auto-generate">
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value)} />
          </FormField>
        </div>
        <FormField label="Description">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </FormField>
      </FormSection>
    </FormPage>
  );
}
