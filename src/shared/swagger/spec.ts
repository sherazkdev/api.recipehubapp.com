const jsonBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema } },
});

const ok = { 200: { description: "Success" }, 401: { description: "Unauthorized" } };
const okPublic = { 200: { description: "Success" } };
const mutating = {
  200: { description: "Success" },
  400: { description: "Invalid request" },
  401: { description: "Unauthorized" },
};

const idQuery = {
  name: "id",
  in: "query",
  required: true,
  schema: { type: "string" },
};

const recipeLangQuery = {
  name: "lang",
  in: "query",
  required: false,
  schema: { type: "string", default: "en", example: "ur" },
  description:
    "Recipe translation to return for list and single fetch (id or slug). Default en. If that language is missing, English is returned. Must be an active dashboard language.",
};

const cuisineLangQuery = {
  name: "lang",
  in: "query",
  required: false,
  schema: { type: "string", default: "en", example: "ur" },
  description:
    "Cuisine translation to return for list and single fetch (id or slug). Default en. If that language is missing, English is returned. Must be an active dashboard language. Slug is not translated.",
};

const nutritionSchema = {
  type: "object",
  description: "Per-serving nutrition. Calories are a top-level recipe field, not inside nutrition.",
  properties: {
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
    fiber: { type: "number" },
    sugar: { type: "number" },
    sodium: { type: "number" },
    saturatedFat: { type: "number" },
    cholesterol: { type: "number" },
  },
};

const recipeIngredientSchema = {
  type: "object",
  required: ["name"],
  properties: {
    name: { type: "string" },
    amount: { type: "string" },
    unit: { type: "string" },
  },
};

const recipeStepSchema = {
  type: "object",
  required: ["order", "text"],
  properties: {
    order: { type: "number" },
    title: { type: "string" },
    durationMin: { type: "number" },
    text: { type: "string" },
    imagePath: { type: "string", description: "Relative upload path or full URL stored on the record" },
    imageUrl: { type: "string", description: "Full public URL. Accepted on write; always returned on read." },
  },
};

const recipeContentSchema = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    chefTips: { type: "array", items: { type: "string" } },
    ingredients: { type: "array", items: recipeIngredientSchema },
    steps: { type: "array", items: recipeStepSchema },
  },
};

const recipeWriteExample = {
  slug: "creamy-garlic-pasta",
  cuisineId: "64f0c0a1b2c3d4e5f6789012",
  imagePath: "recipes/creamy-garlic-pasta.jpg",
  imageUrl: "https://recipehubapi.com/uploads/recipes/creamy-garlic-pasta.jpg",
  prepTime: 25,
  calories: 420,
  difficulty: "easy",
  servings: 2,
  status: "draft",
  nutrition: {
    protein: 14,
    carbs: 52,
    fat: 16,
    fiber: 3,
    sugar: 4,
    sodium: 480,
    saturatedFat: 6,
    cholesterol: 30,
  },
  content: {
    title: "Creamy Garlic Pasta",
    description: "A quick English recipe. Other active languages are translated on save.",
    tags: ["pasta", "quick"],
    chefTips: ["Salt the pasta water well."],
    ingredients: [{ name: "Pasta", amount: "200", unit: "g" }],
    steps: [{ order: 1, title: "Boil", durationMin: 10, text: "Cook the pasta until al dente." }],
  },
};

const scanResponseSchema = {
  type: "object",
  properties: {
    is_food: { type: "boolean" },
    message: { type: "string", description: "Shown when is_food is false" },
    ingredients: { type: "array", items: { type: "string" } },
    dish_name: { type: "string", nullable: true },
  },
};

const chatRecipeSchema = {
  type: "object",
  description: "AI-generated recipe JSON. Empty object {} when prompt is not food-related (foodOnlyMode).",
  properties: {
    title: { type: "string" },
    cook_time: { type: "string", description: "Minutes as string number" },
    calories: { type: "number" },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    chef_tips: { type: "array", items: { type: "string" } },
    nutrition: {
      type: "object",
      properties: {
        calories: { type: "number" },
        carbs_g: { type: "number" },
        protein_g: { type: "number" },
        fat_g: { type: "number" },
        fiber_g: { type: "number" },
        sugar_g: { type: "number" },
        saturated_fat_g: { type: "number" },
        sodium_mg: { type: "number" },
        cholesterol_mg: { type: "number" },
      },
    },
    image: { type: "string", description: "Optional Pollinations URL when imageSource is pollinations" },
  },
};

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Recipe Hub Admin API",
    version: "1.0.0",
    description:
      "Admin API + mobile AI endpoints (scan, chat). Create/update recipes and cuisines in English; every active dashboard language is translated on save. lang picks the translation for recipe and cuisine GET (list or single fetch; default en; English fallback if that translation is missing). Recipe/cuisine reads include imageUrl computed from imagePath + PUBLIC_APP_URL. Auth: Bearer JWT or x-api-key.",
  },
  servers: [{ url: "/api", description: "Current host" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
    },
  },
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  tags: [
    { name: "Auth" },
    { name: "AI" },
    { name: "Recipes" },
    { name: "Cuisines" },
    { name: "Languages" },
    { name: "Settings" },
    { name: "API Keys" },
    { name: "System" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Public health check",
        security: [],
        responses: okPublic,
      },
    },
    "/scan": {
      post: {
        tags: ["AI"],
        summary: "Scan food photo (vision)",
        description:
          "Mobile scan flow. Send base64 image. fridge_mode=true lists fridge/ingredient items; false identifies a finished dish. Does not save a recipe to the catalog.",
        requestBody: jsonBody({
          type: "object",
          required: ["image_base64"],
          properties: {
            image_base64: { type: "string", description: "Base64-encoded image (no data: prefix)" },
            mime: { type: "string", default: "image/jpeg", example: "image/jpeg" },
            language: { type: "string", default: "English", example: "English" },
            fridge_mode: { type: "boolean", default: false, description: "true = fridge/ingredients, false = finished dish" },
          },
        }),
        responses: {
          200: {
            description: "Scan result",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: scanResponseSchema } } } },
          },
          400: { description: "Invalid request or rate limit" },
          401: { description: "Unauthorized" },
          503: { description: "Maintenance mode" },
        },
      },
    },
    "/chat": {
      post: {
        tags: ["AI"],
        summary: "Generate recipe from prompt",
        description:
          "Mobile recipe generation. Returns AI JSON (title, ingredients, steps, nutrition, optional image). Does not save to the catalog. Empty {} when foodOnlyMode rejects the prompt.",
        requestBody: jsonBody({
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: { type: "string", example: "Quick chicken curry with rice" },
            language: { type: "string", default: "English", example: "English" },
          },
        }),
        responses: {
          200: {
            description: "Generated recipe JSON",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: chatRecipeSchema } } } },
          },
          400: { description: "Invalid request or rate limit" },
          401: { description: "Unauthorized" },
          503: { description: "Maintenance mode" },
        },
      },
    },
    "/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin login",
        description:
          "Send password plus one of email, username, or identifier. The route reads `email ?? username ?? identifier`.",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["password"],
          properties: {
            email: { type: "string", description: "Admin email. Alternative to username or identifier." },
            username: { type: "string", description: "Admin username. Alternative to email or identifier." },
            identifier: { type: "string", description: "Email or username. Alternative to the email/username fields." },
            password: { type: "string" },
          },
        }),
        responses: { 200: { description: "Access token issued" }, 401: { description: "Invalid credentials" } },
      },
    },
    "/admin/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        security: [],
        responses: { 200: { description: "New access token" }, 401: { description: "Invalid refresh token" } },
      },
    },
    "/admin/logout": {
      post: { tags: ["Auth"], summary: "Logout admin", responses: okPublic },
    },
    "/admin/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change admin password",
        requestBody: jsonBody({
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string" },
            confirmPassword: { type: "string" },
          },
        }),
        responses: mutating,
      },
    },
    "/admin/recipes": {
      get: {
        tags: ["Recipes"],
        summary: "List recipes or get one recipe",
        description:
          "Same GET for list and single fetch. lang picks the translation for both (default en; English fallback if missing). Use id or slug for one recipe. Other filters apply only when sent. page/limit paginate. Omit sort to keep admin drag-and-drop order.",
        parameters: [
          recipeLangQuery,
          { name: "id", in: "query", schema: { type: "string" }, description: "Return one recipe by id" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Return one recipe by slug" },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "archived"] } },
          { name: "cuisineId", in: "query", schema: { type: "string" } },
          { name: "cuisineSlug", in: "query", schema: { type: "string" } },
          { name: "difficulty", in: "query", schema: { type: "string", enum: ["easy", "medium", "hard"] } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Search title in lang, with English fallback" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["updatedAt", "-updatedAt", "title", "-title", "calories", "-calories", "prepTime", "-prepTime"] } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
        ],
        responses: ok,
      },
      post: {
        tags: ["Recipes"],
        summary: "Create recipe",
        description:
          "English content only. On save, translations are written for every active language in the dashboard Languages section.",
        requestBody: jsonBody({
          type: "object",
          required: ["cuisineId"],
          properties: {
            slug: { type: "string" },
            cuisineId: { type: "string" },
            imagePath: { type: "string", description: "Relative upload path or full URL stored on the record" },
    imageUrl: { type: "string", description: "Full public URL. Accepted on write; always returned on read." },
            prepTime: { type: "number" },
            calories: { type: "number" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            servings: { type: "number" },
            status: { type: "string", enum: ["draft", "published", "archived"] },
            sortOrder: { type: "number" },
            nutrition: nutritionSchema,
            content: recipeContentSchema,
          },
          example: recipeWriteExample,
        }),
        responses: mutating,
      },
      put: {
        tags: ["Recipes"],
        summary: "Update recipe",
        description:
          "Update English content. Translations refresh for every active language. To persist admin list order, send { reorder: [id, id, ...] } instead of a single-recipe update.",
        requestBody: jsonBody({
          type: "object",
          properties: {
            id: { type: "string" },
            slug: { type: "string" },
            cuisineId: { type: "string" },
            imagePath: { type: "string", description: "Relative upload path or full URL stored on the record" },
    imageUrl: { type: "string", description: "Full public URL. Accepted on write; always returned on read." },
            prepTime: { type: "number" },
            calories: { type: "number" },
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            servings: { type: "number" },
            status: { type: "string", enum: ["draft", "published", "archived"] },
            sortOrder: { type: "number" },
            nutrition: nutritionSchema,
            content: recipeContentSchema,
            reorder: { type: "array", items: { type: "string" }, description: "Recipe ids in the desired list order" },
          },
          example: { id: "64f0c0a1b2c3d4e5f6789013", ...recipeWriteExample },
        }),
        responses: mutating,
      },
      delete: {
        tags: ["Recipes"],
        summary: "Delete recipe",
        parameters: [idQuery],
        responses: mutating,
      },
    },
    "/admin/recipes/import": {
      post: {
        tags: ["Recipes"],
        summary: "Import recipes from CSV",
        description:
          "CSV columns: title, cuisineSlug, slug, prepTime, calories, difficulty, servings, status, description. English columns only. Translations are created for all active languages.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: mutating,
      },
    },
    "/admin/recipes/export": {
      get: {
        tags: ["Recipes"],
        summary: "Export recipes as CSV",
        parameters: [
          {
            name: "template",
            in: "query",
            schema: { type: "string", enum: ["1"] },
            description: "Set to 1 to download a blank sample CSV",
          },
        ],
        responses: { 200: { description: "CSV file" }, 401: { description: "Unauthorized" } },
      },
    },
    "/admin/recipes/bulk-upload": {
      post: {
        tags: ["Recipes"],
        summary: "Bulk upload images by recipe slug",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["files"],
                properties: {
                  files: { type: "array", items: { type: "string", format: "binary" } },
                },
              },
            },
          },
        },
        responses: mutating,
      },
    },
    "/admin/upload": {
      post: {
        tags: ["Recipes"],
        summary: "Upload a single image",
        description: "JPG, PNG, WebP, or GIF. Max 10MB.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                  subdir: { type: "string", enum: ["recipes", "cuisines", "flags"] },
                },
              },
            },
          },
        },
        responses: mutating,
      },
    },
    "/admin/cuisines": {
      get: {
        tags: ["Cuisines"],
        summary: "List cuisines or get one cuisine",
        description:
          "Same GET for list and single fetch. lang picks the translation for both (default en; English fallback if missing). Use id or slug for one cuisine. q searches localized name, slug, or description. Slug is language-independent.",
        parameters: [
          cuisineLangQuery,
          { name: "id", in: "query", schema: { type: "string" }, description: "Return one cuisine by id" },
          { name: "slug", in: "query", schema: { type: "string" }, description: "Return one cuisine by slug" },
          { name: "q", in: "query", schema: { type: "string" }, description: "Search name or description in lang, with English fallback, plus slug" },
        ],
        responses: ok,
      },
      post: {
        tags: ["Cuisines"],
        summary: "Create cuisine",
        description:
          "English name and description only. On save, translations are written for every active language in the dashboard Languages section. Slug is not translated.",
        requestBody: jsonBody({
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            slug: { type: "string" },
            imagePath: { type: "string", description: "Relative upload path or full URL stored on the record" },
    imageUrl: { type: "string", description: "Full public URL. Accepted on write; always returned on read." },
            description: { type: "string" },
            sortOrder: { type: "number" },
          },
        }),
        responses: mutating,
      },
      put: {
        tags: ["Cuisines"],
        summary: "Update cuisine",
        description:
          "Update English name and description. Translations refresh for every active language. Slug stays language-independent. To persist admin list order, send { reorder: [id, id, ...] } instead of a single-cuisine update.",
        requestBody: jsonBody({
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            imagePath: { type: "string", description: "Relative upload path or full URL stored on the record" },
    imageUrl: { type: "string", description: "Full public URL. Accepted on write; always returned on read." },
            description: { type: "string" },
            sortOrder: { type: "number" },
            reorder: { type: "array", items: { type: "string" }, description: "Cuisine ids in the desired list order" },
          },
        }),
        responses: mutating,
      },
      delete: {
        tags: ["Cuisines"],
        summary: "Delete cuisine",
        parameters: [idQuery],
        responses: mutating,
      },
    },
    "/admin/languages": {
      get: {
        tags: ["Languages"],
        summary: "List languages",
        parameters: [
          { name: "isActive", in: "query", schema: { type: "boolean" }, description: "Filter active or inactive languages" },
        ],
        responses: ok,
      },
      post: {
        tags: ["Languages"],
        summary: "Create language",
        description: "Existing English recipes and cuisines are translated into the new language.",
        requestBody: jsonBody({
          type: "object",
          required: ["code", "name"],
          properties: {
            code: { type: "string", example: "ur" },
            name: { type: "string" },
            nativeName: { type: "string" },
            flag: { type: "string" },
            isActive: { type: "boolean" },
            sortOrder: { type: "number" },
          },
        }),
        responses: mutating,
      },
      put: {
        tags: ["Languages"],
        summary: "Update language",
        description:
          "Language code cannot be changed after create. To persist admin list order, send { reorder: [id, id, ...] } instead of a single-language update.",
        requestBody: jsonBody({
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            nativeName: { type: "string" },
            flag: { type: "string" },
            isActive: { type: "boolean" },
            sortOrder: { type: "number" },
            reorder: { type: "array", items: { type: "string" }, description: "Language ids in the desired list order" },
          },
        }),
        responses: mutating,
      },
      delete: {
        tags: ["Languages"],
        summary: "Delete language",
        parameters: [idQuery],
        responses: mutating,
      },
    },
    "/admin/api-keys": {
      get: { tags: ["API Keys"], summary: "List API keys", responses: ok },
      post: {
        tags: ["API Keys"],
        summary: "Create API key",
        requestBody: jsonBody({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        }),
        responses: mutating,
      },
      delete: {
        tags: ["API Keys"],
        summary: "Revoke API key",
        parameters: [idQuery],
        responses: mutating,
      },
    },
    "/admin/dashboard": {
      get: { tags: ["System"], summary: "Dashboard stats", responses: ok },
    },
    "/admin/ai-activity": {
      get: {
        tags: ["System"],
        summary: "AI activity log",
        description:
          "Paginated AI scan/generate events. Use summary=1 for chart stats. Use export=csv to download CSV.",
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["all", "generate", "scan", "failed"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date", example: "2026-09-01" } },
          { name: "to", in: "query", schema: { type: "string", format: "date", example: "2026-09-08" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "summary", in: "query", schema: { type: "string", enum: ["1"] }, description: "Return chart summary instead of rows" },
          { name: "export", in: "query", schema: { type: "string", enum: ["csv"] }, description: "Download CSV export" },
        ],
        responses: ok,
      },
    },
    "/admin/settings": {
      get: {
        tags: ["Settings"],
        summary: "Get admin settings",
        description: "Returns general + AI settings (Groq key masked).",
        responses: ok,
      },
      put: {
        tags: ["Settings"],
        summary: "Update admin settings",
        description: "Send section general or ai with a data object.",
        requestBody: jsonBody({
          type: "object",
          required: ["section", "data"],
          properties: {
            section: { type: "string", enum: ["general", "ai"] },
            data: { type: "object", description: "Fields for the selected section" },
          },
        }),
        responses: mutating,
      },
    },
    "/admin/settings/test-groq": {
      post: {
        tags: ["Settings"],
        summary: "Test Groq API connection",
        requestBody: jsonBody({
          type: "object",
          properties: {
            groqApiKey: { type: "string", description: "Optional override; uses saved key when omitted" },
            recipeModel: { type: "string", description: "Optional override; uses saved model when omitted" },
          },
        }),
        responses: {
          200: { description: "Connection result with ok true/false" },
          400: { description: "Missing API key" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/system": {
      get: { tags: ["System"], summary: "System health status", responses: ok },
    },
  },
};