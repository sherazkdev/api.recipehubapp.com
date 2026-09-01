import { clearCache } from "@/shared/cache/lru";

export function invalidateRecipeCaches() {
  clearCache("dashboard");
  clearCache("recipe-list");
}

export function invalidateCatalogCaches() {
  clearCache("catalog");
  clearCache("cuisine-list");
  clearCache("dashboard");
  clearCache("lang-codes");
}

export function invalidateAuthCaches() {
  clearCache("auth-admin");
  clearCache("api-key-verify");
}