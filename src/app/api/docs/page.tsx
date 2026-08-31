"use client";

import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function ApiDocsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="api-docs-scroll flex items-center justify-center bg-[var(--page-bg)] text-[var(--text-muted)]">
        Loading API docs…
      </div>
    );
  }

  return (
    <div className="api-docs-scroll bg-[var(--page-bg)]">
      <SwaggerUI
        url="/api/openapi"
        persistAuthorization
        tryItOutEnabled
        docExpansion="list"
        filter
        deepLinking
      />
    </div>
  );
}
