import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const cuisineSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    imagePath: { type: String, default: "" },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

export type CuisineDocument = InferSchemaType<typeof cuisineSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Cuisine: Model<CuisineDocument> =
  mongoose.models.Cuisine ?? mongoose.model("Cuisine", cuisineSchema);
