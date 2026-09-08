import mongoose, { InferSchemaType, Schema } from "mongoose";
import { DEFAULT_AI, DEFAULT_GENERAL } from "@/features/settings/types";

const settingsSchema = new Schema(
  {
    _id: { type: String, default: "system" },
    general: {
      appName: { type: String, default: DEFAULT_GENERAL.appName },
      supportEmail: { type: String, default: DEFAULT_GENERAL.supportEmail },
      defaultLanguage: { type: String, default: DEFAULT_GENERAL.defaultLanguage },
      maintenanceMode: { type: Boolean, default: DEFAULT_GENERAL.maintenanceMode },
      maintenanceMessage: { type: String, default: DEFAULT_GENERAL.maintenanceMessage },
      allowedIps: { type: String, default: DEFAULT_GENERAL.allowedIps },
    },
    ai: {
      groqApiKey: { type: String, default: DEFAULT_AI.groqApiKey },
      recipeModel: { type: String, default: DEFAULT_AI.recipeModel },
      visionModel: { type: String, default: DEFAULT_AI.visionModel },
      defaultLanguage: { type: String, default: DEFAULT_AI.defaultLanguage },
      maxRequestsPerMinute: { type: Number, default: DEFAULT_AI.maxRequestsPerMinute },
      maxScanImageMb: { type: Number, default: DEFAULT_AI.maxScanImageMb },
      foodOnlyMode: { type: Boolean, default: DEFAULT_AI.foodOnlyMode },
      includeNutrition: { type: Boolean, default: DEFAULT_AI.includeNutrition },
      minSteps: { type: Number, default: DEFAULT_AI.minSteps },
      maxSteps: { type: Number, default: DEFAULT_AI.maxSteps },
      imageSource: { type: String, enum: ["pollinations", "none"], default: DEFAULT_AI.imageSource },
    },
  },
  { timestamps: true, collection: "settings" },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema> & { _id: string };

export const Settings =
  (mongoose.models.Settings as mongoose.Model<SettingsDoc>) ??
  mongoose.model<SettingsDoc>("Settings", settingsSchema);
