"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormPage } from "@/components/forms/form-page";
import { FormSection } from "@/components/ui/feedback";
import { FormField, TextInput, Toggle } from "@/components/ui/fields";
import { apiPost, apiPut, ApiError } from "@/lib/api-client";
import { adminPath } from "@/lib/admin-path";

type LanguageInitial = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isActive: boolean;
};

export function LanguageForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: LanguageInitial;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [nativeName, setNativeName] = useState(initial?.nativeName ?? "");
  const [flag, setFlag] = useState(initial?.flag ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        code: code.trim().toLowerCase(),
        name: name.trim(),
        nativeName: nativeName.trim(),
        flag: flag.trim(),
        isActive,
      };
      if (mode === "create") {
        await apiPost("/api/admin/languages", payload);
      } else if (initial?.id) {
        await apiPut("/api/admin/languages", { id: initial.id, ...payload });
      }
      router.push(adminPath("/languages"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save language");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormPage
      title={mode === "create" ? "Add Language" : "Edit Language"}
      subtitle={
        mode === "create"
          ? "Add a locale. Existing English recipes will be translated into it."
          : "Update language details. English cannot be deactivated."
      }
      loadingLabel={mode === "create" ? "Saving and translating…" : "Saving…"}
      backHref={adminPath("/languages")}
      backLabel="Back to Languages"
      submitLabel={mode === "create" ? "Create Language" : "Save Changes"}
      loading={loading}
      error={error}
      ungrouped
      onSubmit={() => handleSubmit()}
    >
      <FormSection variant="card" title="Language" description="ISO code, names, and visibility.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Code" required hint="2-letter ISO code, e.g. ur">
            <TextInput value={code} onChange={(event) => setCode(event.target.value)} disabled={mode === "edit"} />
          </FormField>
          <FormField label="Name" required>
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <FormField label="Native Name">
            <TextInput value={nativeName} onChange={(event) => setNativeName(event.target.value)} />
          </FormField>
          <FormField label="Flag" hint="Emoji or icon text">
            <TextInput value={flag} onChange={(event) => setFlag(event.target.value)} placeholder="🇵🇰" />
          </FormField>
        </div>
        <FormField label="Active" hint={initial?.code === "en" ? "English stays active as the source language" : undefined}>
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            label={isActive ? "Active" : "Inactive"}
            disabled={initial?.code === "en"}
          />
        </FormField>
      </FormSection>
    </FormPage>
  );
}
