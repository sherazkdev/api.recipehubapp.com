import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const tokenSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

tokenSchema.index({ adminId: 1, createdAt: -1 });
tokenSchema.index({ adminId: 1, isActive: 1 });

export type ApiKeyDocument = InferSchemaType<typeof tokenSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApiKey: Model<ApiKeyDocument> =
  mongoose.models.ApiKey ?? mongoose.model("ApiKey", tokenSchema);
