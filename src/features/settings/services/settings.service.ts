import { Settings } from "@/features/settings/models/settings.model";
import type { AiSettings, GeneralSettings } from "@/features/settings/types";
import { DEFAULT_AI, DEFAULT_GENERAL } from "@/features/settings/types";
import { getEnv } from "@/shared/config/env";

function maskApiKey(key: string) {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 7)}•••••${trimmed.slice(-4)}`;
}

function mergeGeneral(source: Partial<GeneralSettings> | undefined): GeneralSettings {
  return { ...DEFAULT_GENERAL, ...(source ?? {}) };
}

function mergeAi(source: Partial<AiSettings> | undefined): AiSettings {
  const ai = { ...DEFAULT_AI, ...(source ?? {}) };
  const deprecatedVision = new Set([
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
  ]);
  const deprecatedRecipe = new Set([
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
  ]);
  if (deprecatedVision.has(ai.visionModel)) ai.visionModel = DEFAULT_AI.visionModel;
  if (deprecatedRecipe.has(ai.recipeModel)) ai.recipeModel = DEFAULT_AI.recipeModel;
  if (!ai.groqApiKey.trim()) {
    const fromEnv = getEnv().GROQ_API_KEY?.trim() ?? "";
    if (fromEnv) ai.groqApiKey = fromEnv;
  }
  return ai;
}

export async function getSettingsDocument() {
  const existing = await Settings.findById("system");
  if (existing) return existing;
  return Settings.create({ _id: "system" });
}

export async function getSettingsForAdmin() {
  const doc = await getSettingsDocument();
  const general = mergeGeneral(doc.general as GeneralSettings);
  const ai = mergeAi(doc.ai as AiSettings);
  const { groqApiKey, ...aiSafe } = ai;
  return {
    general,
    ai: { ...aiSafe, groqApiKeyMasked: maskApiKey(groqApiKey) },
  };
}

export async function getSettingsInternal() {
  const doc = await getSettingsDocument();
  return {
    general: mergeGeneral(doc.general as GeneralSettings),
    ai: mergeAi(doc.ai as AiSettings),
  };
}

export async function updateGeneralSettings(data: Partial<GeneralSettings>) {
  const doc = await getSettingsDocument();
  doc.general = { ...mergeGeneral(doc.general as GeneralSettings), ...data };
  await doc.save();
  return mergeGeneral(doc.general as GeneralSettings);
}

export async function updateAiSettings(data: Partial<AiSettings>) {
  const doc = await getSettingsDocument();
  const current = mergeAi(doc.ai as AiSettings);
  const next = { ...current, ...data };
  if (typeof data.groqApiKey === "string" && !data.groqApiKey.trim()) {
    next.groqApiKey = current.groqApiKey;
  }
  doc.ai = next;
  await doc.save();
  const saved = mergeAi(doc.ai as AiSettings);
  const { groqApiKey, ...aiSafe } = saved;
  return { ...aiSafe, groqApiKeyMasked: maskApiKey(groqApiKey) };
}

export function isMaintenanceBlocked(clientIp: string, general: GeneralSettings) {
  if (!general.maintenanceMode) return false;
  const allowed = general.allowedIps
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.length) return true;
  return !allowed.includes(clientIp);
}
