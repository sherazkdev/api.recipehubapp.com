import mongoose from "mongoose";

export function parseReorderIds(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (id): id is string => typeof id === "string" && mongoose.isValidObjectId(id),
  );
  return ids;
}

export async function applyReorder(model: { updateOne: Function }, ids: string[]) {
  await Promise.all(
    ids.map((id, index) => model.updateOne({ _id: id }, { $set: { sortOrder: index } })),
  );
}

export async function nextSortOrder(model: { findOne: Function }) {
  const last = (await model.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean()) as {
    sortOrder?: number;
  } | null;
  return (last?.sortOrder ?? -1) + 1;
}
