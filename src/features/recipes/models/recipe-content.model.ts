import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ingredientSchema = new Schema(
  {
    name: { type: String, required: true },
    amount: { type: String, default: "" },
    unit: { type: String, default: "" },
  },
  { _id: false },
);

const stepSchema = new Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, default: "" },
    durationMin: { type: Number, default: 0 },
    text: { type: String, required: true },
    imagePath: { type: String, default: "" },
  },
  { _id: false },
);

const recipeContentSchema = new Schema(
  {
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    langCode: { type: String, required: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    chefTips: { type: [String], default: [] },
    ingredients: { type: [ingredientSchema], default: [] },
    steps: { type: [stepSchema], default: [] },
  },
  { timestamps: true },
);

recipeContentSchema.index({ recipeId: 1, langCode: 1 }, { unique: true });
recipeContentSchema.index({ langCode: 1, title: 1 });

export type RecipeContentDocument = InferSchemaType<typeof recipeContentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RecipeContent: Model<RecipeContentDocument> =
  mongoose.models.RecipeContent ?? mongoose.model("RecipeContent", recipeContentSchema);
