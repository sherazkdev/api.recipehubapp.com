export type GeneralSettings = {
  appName: string;
  supportEmail: string;
  defaultLanguage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedIps: string;
};

export type AiSettings = {
  groqApiKey: string;
  recipeModel: string;
  visionModel: string;
  defaultLanguage: string;
  maxRequestsPerMinute: number;
  maxScanImageMb: number;
  foodOnlyMode: boolean;
  includeNutrition: boolean;
  minSteps: number;
  maxSteps: number;
  imageSource: "pollinations" | "none";
};

export type SettingsPayload = {
  general: GeneralSettings;
  ai: AiSettings;
};

export const DEFAULT_GENERAL: GeneralSettings = {
  appName: "Recipe Hub",
  supportEmail: "support@recipehub.example",
  defaultLanguage: "en",
  maintenanceMode: false,
  maintenanceMessage: "We are performing scheduled maintenance. Please check back soon.",
  allowedIps: "",
};

export const DEFAULT_AI: AiSettings = {
  groqApiKey: "",
  recipeModel: "openai/gpt-oss-20b",
  visionModel: "qwen/qwen3.6-27b",
  defaultLanguage: "English",
  maxRequestsPerMinute: 30,
  maxScanImageMb: 5,
  foodOnlyMode: true,
  includeNutrition: true,
  minSteps: 4,
  maxSteps: 12,
  imageSource: "pollinations",
};

export const GROQ_RECIPE_MODELS = [
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
] as const;

export const GROQ_VISION_MODELS = [
  "qwen/qwen3.6-27b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3.8-27b",
] as const;
