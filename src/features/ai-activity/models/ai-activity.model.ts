import mongoose, { InferSchemaType, Schema } from "mongoose";

const aiActivitySchema = new Schema(
  {
    type: { type: String, enum: ["generate", "scan"], required: true, index: true },
    status: { type: String, enum: ["success", "failed"], required: true, index: true },
    inputSummary: { type: String, default: "" },
    durationMs: { type: Number, default: 0 },
    error: { type: String, default: "" },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", index: true },
  },
  { timestamps: true, collection: "ai_activities" },
);

aiActivitySchema.index({ createdAt: -1 });

export type AiActivityDoc = InferSchemaType<typeof aiActivitySchema>;

export const AiActivity =
  (mongoose.models.AiActivity as mongoose.Model<AiActivityDoc>) ??
  mongoose.model<AiActivityDoc>("AiActivity", aiActivitySchema);
