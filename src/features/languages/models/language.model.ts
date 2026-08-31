import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const languageSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    nativeName: { type: String, default: "" },
    flag: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

languageSchema.index({ isActive: 1 });

export type LanguageDocument = InferSchemaType<typeof languageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Language: Model<LanguageDocument> =
  mongoose.models.Language ?? mongoose.model("Language", languageSchema);
