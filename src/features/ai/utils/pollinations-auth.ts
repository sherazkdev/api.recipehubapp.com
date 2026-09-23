/** Optional Pollinations account token (free registration at auth.pollinations.ai) for nologo / limits. */
export function pollinationsBearerToken(): string | null {
  const token =
    process.env.POLLINATIONS_TOKEN?.trim() ||
    process.env.POLLINATIONS_KEY?.trim() ||
    process.env.POLLINATIONS_API_KEY?.trim() ||
    "";
  return token || null;
}

export function pollinationsAuthHeaders(): Record<string, string> {
  const token = pollinationsBearerToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
