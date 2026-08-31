"use client";

import type { DragEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export function DragHandle({
  disabled,
  onDragStart,
  onDragEnd,
}: {
  disabled?: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      aria-label="Drag to reorder"
      title={disabled ? "Cannot reorder" : "Drag to reorder"}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--text-muted)]",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-grab hover:bg-[var(--surface-hover)] hover:text-ink active:cursor-grabbing",
      )}
    >
      <Icon name="grip" size={16} />
    </button>
  );
}

export function reorderById<T extends { id: string }>(items: T[], fromId: string, toId: string) {
  if (fromId === toId) return items;
  const next = [...items];
  const from = next.findIndex((item) => item.id === fromId);
  const to = next.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0) return items;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
