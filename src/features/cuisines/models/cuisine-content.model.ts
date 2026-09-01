import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const cuisineContentSchema = new Schema(
  {
    cuisineId: { type: Schema.Types.ObjectId, ref: "Cuisine", required: true },
    langCode: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

cuisineContentSchema.index({ cuisineId: 1, langCode: 1 }, { unique: true });
cuisineContentSchema.index({ langCode: 1, name: 1 });

export type CuisineContentDocument = InferSchemaType<typeof cuisineContentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CuisineContent: Model<CuisineContentDocument> =
  mongoose.models.CuisineContent ?? mongoose.model("CuisineContent", cuisineContentSchema);
