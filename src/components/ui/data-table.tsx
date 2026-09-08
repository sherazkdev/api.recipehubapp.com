"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/buttons";
import { Checkbox, SearchInput, Select } from "@/components/ui/fields";
import { ConfirmDeleteModal, EmptyState, SkeletonState } from "@/components/ui/feedback";
import { paginationItems } from "@/shared/utils/status-tone";

export type Column<T> = {
  key: string;
  header: string;
  hideBelow?: "lg" | "xl";
  width?: string;
  render: (row: T) => ReactNode;
};

type FilterDef = {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const items = paginationItems(page, pageCount);
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 pt-3">
      <IconButton onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">
        <Icon name="caretLeft" size={14} />
      </IconButton>
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-[13px] text-[var(--text-muted)]">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-[14px] leading-5",
              item === page ? "bg-[var(--surface-hover)]" : "hover:bg-[var(--surface-hover)]",
            )}
          >
            {item}
          </button>
        ),
      )}
      <IconButton
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        aria-label="Next page"
      >
        <Icon name="caretRight" size={14} />
      </IconButton>
    </div>
  );
}

export function DataTable<T>({
  title,
  rows,
  columns,
  getRowId,
  getRowName,
  resourceLabel,
  addHref = "#",
  addLabel = "Add",
  searchPlaceholder = "Search",
  filters,
  editHref = () => "#",
  loading = false,
  showAdd = true,
  showRowActions = true,
  showReorder = false,
  onReorder,
  onDelete,
}: {
  title: string;
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  getRowName: (row: T) => string;
  resourceLabel: string;
  addHref?: string;
  addLabel?: string;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  editHref?: (row: T) => string;
  loading?: boolean;
  showAdd?: boolean;
  showRowActions?: boolean;
  showReorder?: boolean;
  onReorder?: (ids: string[]) => void | Promise<void>;
  onDelete?: (row: T) => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pageSize = 8;
  const canDrag = showReorder && query.trim().length === 0;
  const incomingKey = rows.map(getRowId).join("\0");

  useEffect(() => {
    setOrderIds(incomingKey ? incomingKey.split("\0") : []);
  }, [incomingKey]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuFor(null);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const sourceRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const a = (left as { sortOrder?: number }).sortOrder ?? 0;
      const b = (right as { sortOrder?: number }).sortOrder ?? 0;
      return a - b;
    });
  }, [rows]);

  const orderedRows = useMemo(() => {
    const map = new Map(sourceRows.map((row) => [getRowId(row), row]));
    const seen = new Set<string>();
    const next: T[] = [];
    for (const id of orderIds) {
      const row = map.get(id);
      if (row) {
        next.push(row);
        seen.add(id);
      }
    }
    for (const row of sourceRows) {
      const id = getRowId(row);
      if (!seen.has(id)) next.push(row);
    }
    if (sortDir === "desc") return [...next].reverse();
    return next;
  }, [getRowId, orderIds, sortDir, sourceRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderedRows;
    return orderedRows.filter((row) => getRowName(row).toLowerCase().includes(q));
  }, [getRowName, orderedRows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selected.includes(getRowId(row)));

  const moveRow = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = orderedRows.map((row) => getRowId(row));
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrderIds(next);
    setSortDir("asc");
    if (onReorder) void Promise.resolve(onReorder(next));
  };

  return (
    <div className="flex min-h-0 flex-col">
      {title ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 md:mb-5">
          <h1 className="text-[14px] font-semibold leading-5">{title}</h1>
        </div>
      ) : null}
      <div className="flex flex-col">
        <div className="mb-1 flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 rounded-[8px] bg-[var(--toolbar-bg)] px-2 py-1.5">
          <div className="flex items-center gap-1">
            {showAdd ? (
              <IconButton aria-label={addLabel} onClick={() => router.push(addHref)}>
                <Icon name="plus" size={16} />
              </IconButton>
            ) : null}
            <div className="relative">
              <IconButton aria-label="Filter" active={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
                <Icon name="filter" size={16} />
              </IconButton>
              {filterOpen && filters?.length ? (
                <div className="absolute left-0 top-8 z-20 w-56 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-xs)]">
                  <div className="flex flex-col gap-2">
                    {filters.map((filter) => (
                      <label key={filter.key} className="flex flex-col gap-1">
                        <span className="typo-helper">{filter.label}</span>
                        <Select value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
                          {filter.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <IconButton aria-label="Sort" onClick={() => setSortDir((value) => (value === "asc" ? "desc" : "asc"))}>
              <Icon name="sort" size={16} />
            </IconButton>
          </div>
          <SearchInput
            className="w-full min-w-[140px] sm:w-[160px]"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
          />
        </div>

        {loading ? (
          <SkeletonState />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? "No results" : `No ${resourceLabel.toLowerCase()}s yet`}
            description={query ? "Try a different search term." : `${addLabel} to add a ${resourceLabel.toLowerCase()}.`}
          />
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-0 [&_td]:align-middle [&_th]:align-middle">
              <thead>
                <tr className="typo-table-head">
                  {showReorder ? (
                    <th className="hidden w-10 px-2 py-2 text-left font-normal text-[var(--text-muted)] sm:table-cell">
                      Drag
                    </th>
                  ) : null}
                  {showRowActions ? (
                    <th className="w-10 px-3 py-2 text-left font-normal">
                      <Checkbox
                        checked={allPageSelected}
                        onChange={() => {
                          if (allPageSelected) {
                            const ids = new Set(pageRows.map(getRowId));
                            setSelected((current) => current.filter((id) => !ids.has(id)));
                          } else {
                            setSelected((current) => [...new Set([...current, ...pageRows.map(getRowId)])]);
                          }
                        }}
                      />
                    </th>
                  ) : null}
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "min-w-0 overflow-hidden px-3 py-2 text-left font-normal",
                        column.width,
                        column.hideBelow === "lg" && "hidden lg:table-cell",
                        column.hideBelow === "xl" && "hidden xl:table-cell",
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                  {showRowActions ? <th className="w-12 px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const id = getRowId(row);
                  const isSelected = selected.includes(id);
                  const isOver = overId === id && dragId !== id;
                  return (
                    <tr
                      key={id}
                      onDragOver={(event) => {
                        if (!canDrag) return;
                        event.preventDefault();
                        setOverId(id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragId) moveRow(dragId, id);
                        setDragId(null);
                        setOverId(null);
                      }}
                      className={cn(
                        "typo-table-body wl-row-hover group border-t border-[var(--border)]",
                        isSelected ? "bg-[var(--table-row-selected)]" : "hover:bg-[var(--table-row-hover)]",
                        dragId === id && "opacity-50",
                        isOver && "bg-[var(--nav-hover-bg)] shadow-[inset_0_2px_0_0_var(--bright-purple)]",
                      )}
                    >
                      {showReorder ? (
                        <td className="hidden h-10 border-t border-[var(--border)] px-1 sm:table-cell">
                          <button
                            type="button"
                            draggable={canDrag}
                            aria-label="Drag to reorder"
                            title={canDrag ? "Drag to reorder" : "Clear search to reorder"}
                            onDragStart={(event) => {
                              if (!canDrag) {
                                event.preventDefault();
                                return;
                              }
                              setDragId(id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverId(null);
                            }}
                            className={cn(
                              "flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)]",
                              canDrag
                                ? "cursor-grab hover:bg-[var(--surface-hover)] hover:text-ink active:cursor-grabbing"
                                : "cursor-not-allowed opacity-40",
                            )}
                          >
                            <Icon name="grip" size={16} />
                          </button>
                        </td>
                      ) : null}
                      {showRowActions ? (
                        <td className="h-10 border-t border-[var(--border)] px-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                              )
                            }
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            "min-w-0 overflow-hidden border-t border-[var(--border)] px-3 py-2",
                            column.width,
                            column.hideBelow === "lg" && "hidden lg:table-cell",
                            column.hideBelow === "xl" && "hidden xl:table-cell",
                          )}
                        >
                          <div className="min-w-0 max-w-full overflow-hidden">{column.render(row)}</div>
                        </td>
                      ))}
                      {showRowActions ? (
                        <td className="relative h-10 overflow-visible border-t border-[var(--border)] px-2">
                          <div className="flex justify-end">
                            <IconButton
                              aria-label="Row actions"
                              onClick={() => setMenuFor((current) => (current === id ? null : id))}
                            >
                              <Icon name="dots" size={14} />
                            </IconButton>
                          </div>
                          {menuFor === id ? (
                            <div
                              ref={menuRef}
                              className="absolute right-2 top-9 z-20 min-w-[128px] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-xs)]"
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] hover:bg-[var(--surface-hover)]"
                                onClick={() => {
                                  setMenuFor(null);
                                  router.push(editHref(row));
                                }}
                              >
                                <Icon name="pencil" size={14} />
                                Edit
                              </button>
                              {onDelete ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] text-[var(--bright-red)] hover:bg-[var(--surface-hover)]"
                                  onClick={() => {
                                    setMenuFor(null);
                                    setDeleteTarget(row);
                                  }}
                                >
                                  <Icon name="trash" size={14} />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 ? <Pagination page={safePage} pageCount={pageCount} onPage={setPage} /> : null}
      </div>

      {showRowActions && onDelete ? (
        <>
          <ConfirmDeleteModal
            open={Boolean(deleteTarget)}
            resource={resourceLabel}
            name={deleteTarget ? getRowName(deleteTarget) : undefined}
            deleting={deleting}
            onCancel={() => {
              if (!deleting) {
                setDeleteTarget(null);
                setDeleteError("");
              }
            }}
            onConfirm={() => {
              if (!deleteTarget) return;
              setDeleting(true);
              setDeleteError("");
              void (async () => {
                try {
                  await onDelete(deleteTarget);
                  setDeleteTarget(null);
                } catch {
                  setDeleteError(`Failed to delete ${resourceLabel.toLowerCase()}.`);
                } finally {
                  setDeleting(false);
                }
              })();
            }}
          />
          {deleteError ? (
            <p className="mt-2 text-[12px] leading-[18px] text-[var(--bright-red)]">{deleteError}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
