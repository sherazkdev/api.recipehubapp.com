"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/buttons";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDrop({
  accept,
  multiple = false,
  files,
  onFiles,
  title,
  hint,
  disabled = false,
}: {
  accept: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = Array.from(list);
    onFiles(multiple ? next : next.slice(0, 1));
  };

  if (files.length === 1 && !multiple) {
    const file = files[0];
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name={accept.includes("csv") ? "fileCsv" : "file"} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-5">{file.name}</p>
          <p className="typo-helper">{formatSize(file.size)}</p>
        </div>
        <IconButton aria-label="Remove file" onClick={() => onFiles([])}>
          <Icon name="x" size={14} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          pick(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (!disabled) pick(event.dataTransfer.files);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-[8px] border border-dashed bg-[var(--black-05)] px-3 py-4 text-left transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50",
          dragOver ? "border-[var(--border-strong)] bg-[var(--nav-hover-bg)]" : "border-[var(--border-strong)]",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name="upload" size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] leading-5">{title}</p>
          <p className="typo-helper">{hint}</p>
        </div>
      </button>

      {files.length ? (
        <ul className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--page-bg)]">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 first:border-t-0"
            >
              <span className="min-w-0 truncate text-[13px] leading-5">{file.name}</span>
              <span className="shrink-0 text-[12px] leading-[18px] text-[var(--text-muted)]">
                {formatSize(file.size)}
              </span>
              <IconButton aria-label={`Remove ${file.name}`} onClick={() => onFiles(files.filter((_, i) => i !== index))}>
                <Icon name="x" size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
