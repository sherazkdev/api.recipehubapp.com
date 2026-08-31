export function searchParamsObject(params: URLSearchParams) {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}
