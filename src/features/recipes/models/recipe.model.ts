import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const nutritionSchema = new Schema(
  {
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
    sodium: { type: Number, default: 0 },
    saturatedFat: { type: Number, default: 0 },
    cholesterol: { type: Number, default: 0 },
  },
  { _id: false },
);

const recipeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    cuisineId: { type: Schema.Types.ObjectId, ref: "Cuisine", required: true },
    imagePath: { type: String, default: "" },
    prepTime: { type: Number, default: 0 },
    calories: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    servings: { type: Number, default: 1 },
    nutrition: { type: nutritionSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

recipeSchema.index({ cuisineId: 1, status: 1 });
recipeSchema.index({ updatedAt: -1 });
recipeSchema.index({ status: 1, updatedAt: -1 });

export type RecipeDocument = InferSchemaType<typeof recipeSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Recipe: Model<RecipeDocument> =
  mongoose.models.Recipe ?? mongoose.model("Recipe", recipeSchema);
