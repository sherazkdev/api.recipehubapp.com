import { createHash, randomBytes } from "crypto";
import { ApiKey } from "@/features/tokens/models/token.model";
import { invalidateAuthCaches } from "@/shared/cache/invalidate";
import { cacheGet, cacheSet, getCache } from "@/shared/cache/lru";

const verifyCache = getCache("api-key-verify", 200, 30_000);

const KEY_PREFIX = "rh_";

export function generateApiKey() {
  const secret = randomBytes(32).toString("hex");
  const raw = `${KEY_PREFIX}${secret}`;
  const prefix = `${KEY_PREFIX}${secret.slice(0, 8)}…`;
  const keyHash = hashApiKey(raw);
  return { raw, prefix, keyHash };
}

export function hashApiKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createApiKey(adminId: string, name: string) {
  const { raw, prefix, keyHash } = generateApiKey();
  const doc = await ApiKey.create({
    name,
    keyHash,
    prefix,
    adminId,
    isActive: true,
  });
  invalidateAuthCaches();
  return { doc, raw };
}

export async function verifyApiKey(raw: string) {
  if (!raw.startsWith(KEY_PREFIX) || raw.length > 96) return null;
  const keyHash = hashApiKey(raw);
  const cached = cacheGet<{ adminId: string }>(verifyCache, keyHash);
  if (cached?.adminId) {
    return { adminId: cached.adminId };
  }

  const doc = await ApiKey.findOne({ keyHash, isActive: true, revokedAt: null })
    .select("_id adminId lastUsedAt")
    .lean();
  if (!doc) return null;

  cacheSet(verifyCache, keyHash, { adminId: doc.adminId.toString() });
  const stale = !doc.lastUsedAt || Date.now() - new Date(doc.lastUsedAt).getTime() > 5 * 60_000;
  if (stale) {
    void ApiKey.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
  }
  return { adminId: doc.adminId.toString() };
}

export async function revokeApiKey(id: string, adminId: string) {
  const doc = await ApiKey.findOne({ _id: id, adminId });
  if (!doc) return null;
  doc.isActive = false;
  doc.revokedAt = new Date();
  await doc.save();
  invalidateAuthCaches();
  return doc;
}

export async function listApiKeys(adminId: string) {
  return ApiKey.find({ adminId }).sort({ createdAt: -1 }).lean();
}
