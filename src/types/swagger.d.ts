declare module "swagger-ui-react" {
  import type { ComponentType } from "react";

  export interface SwaggerUIProps {
    url?: string;
    spec?: object;
    persistAuthorization?: boolean;
    tryItOutEnabled?: boolean;
    docExpansion?: "list" | "full" | "none";
    filter?: boolean | string;
    deepLinking?: boolean;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

declare module "swagger-jsdoc" {
  function swaggerJSDoc(options: {
    definition: Record<string, unknown>;
    apis: string[];
  }): Record<string, unknown>;

  export default swaggerJSDoc;
}
