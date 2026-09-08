export type StatusTone = "healthy" | "failed" | "warning";

export function toneOf(status: string): StatusTone {
  const value = status.toLowerCase();
  if (
    ["healthy", "ok", "up", "operational", "online", "connected", "available", "local"].includes(value)
  ) {
    return "healthy";
  }
  if (["down", "failed", "error", "disconnected", "degraded"].includes(value)) {
    return value === "degraded" ? "warning" : "failed";
  }
  return "warning";
}

export function paginationItems(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 1) return [1];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  if (page > 3) items.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  for (let current = start; current <= end; current += 1) {
    items.push(current);
  }

  if (page < pageCount - 2) items.push("ellipsis");
  items.push(pageCount);
  return items;
}
