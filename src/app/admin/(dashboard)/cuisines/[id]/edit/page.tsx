"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CuisineForm } from "@/components/forms/cuisine-form";
import { SkeletonState } from "@/components/ui/feedback";
import { apiGet, ApiError } from "@/lib/api-client";

export default function EditCuisinePage() {
  const params = useParams<{ id: string }>();
  const [cuisine, setCuisine] = useState<{
    id: string;
    name: string;
    slug: string;
    description: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const found = await apiGet<{
          id: string;
          name: string;
          slug: string;
          description: string;
        }>(`/api/admin/cuisines?id=${params.id}`);
        setCuisine(found);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load cuisine");
      }
    })();
  }, [params.id]);

  if (error) return <p className="text-[13px] text-[var(--bright-red)]">{error}</p>;
  if (!cuisine) return <SkeletonState rows={4} />;
  return <CuisineForm mode="edit" initial={cuisine} />;
}
