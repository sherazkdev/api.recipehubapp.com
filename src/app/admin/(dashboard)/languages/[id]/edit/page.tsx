"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LanguageForm } from "@/components/forms/language-form";
import { SkeletonState } from "@/components/ui/feedback";
import { apiGet, ApiError } from "@/lib/api-client";

export default function EditLanguagePage() {
  const params = useParams<{ id: string }>();
  const [language, setLanguage] = useState<{
    id: string;
    code: string;
    name: string;
    nativeName: string;
    flag: string;
    isActive: boolean;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const items = await apiGet<
          {
            id: string;
            code: string;
            name: string;
            nativeName: string;
            flag: string;
            isActive: boolean;
          }[]
        >("/api/admin/languages");
        const found = items.find((item) => item.id === params.id);
        if (!found) {
          setError("Language not found");
          return;
        }
        setLanguage(found);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load language");
      }
    })();
  }, [params.id]);

  if (error) return <p className="text-[13px] text-[var(--bright-red)]">{error}</p>;
  if (!language) return <SkeletonState rows={4} />;
  return <LanguageForm mode="edit" initial={language} />;
}
