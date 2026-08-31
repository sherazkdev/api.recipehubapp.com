"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { SecondaryButton } from "@/components/ui/buttons";
import { TextInput } from "@/components/ui/fields";

const MAX_MB = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function previewSrc(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  return `/uploads/${path}`;
}

function fileLabel(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/").pop() || url;
  } catch {
    const clean = url.split("?")[0];
    const name = clean.split("/").pop() || url;
    return name.length > 48 ? `${name.slice(0, 45)}…` : name;
  }
}

function UploadMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-10 text-ink", className)} aria-hidden>
      <rect x="8" y="14" width="32" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 30l6-7 5 5 4-4 7 6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="21" r="2" fill="currentColor" />
      <path d="M33 8v8M29 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ImageUpload({
  value,
  onUrlChange,
  onClear,
  onFileSelect,
  uploading = false,
  error,
  compact = false,
}: {
  value: string | null;
  onUrlChange?: (url: string | null) => void;
  onClear?: () => void;
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  error?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");

  const clear = () => {
    onUrlChange?.(null);
    onClear?.();
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setLocalError("");
    if (!file.type.startsWith("image/")) {
      setLocalError("Please choose an image file (JPG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setLocalError(`Image must be ${MAX_MB}MB or smaller.`);
      return;
    }
    onFileSelect(file);
  };

  const displayError = error || localError;

  return (
    <div className={cn("flex w-full flex-col", compact ? "gap-3" : "gap-4")}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[16px] border-2 border-dashed transition-colors duration-200",
          dragOver
            ? "border-[var(--border-strong)] bg-[var(--nav-hover-bg)]"
            : value
              ? "border-[var(--border)] bg-[var(--page-bg)]"
              : "border-[var(--border-strong)] bg-[var(--page-bg)]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          pickFile(event.dataTransfer.files?.[0]);
        }}
      >
        {uploading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--card-bg)]/90">
            <span className="size-8 animate-pulse rounded-full bg-[var(--pastel-purple)]" />
            <p className="text-[13px] font-medium">Uploading image…</p>
          </div>
        ) : null}

        {value ? (
          <div
            className={cn(
              "grid w-full gap-3 p-3 sm:items-center",
              compact ? "grid-cols-1" : "sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4 sm:p-4",
            )}
          >
            <div
              className={cn(
                "relative mx-auto w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card-bg)]",
                compact ? "aspect-[4/3] max-w-none" : "aspect-[4/3] max-w-[220px] sm:mx-0 sm:max-w-none",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc(value)} alt="Recipe preview" className="size-full object-cover" />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--status-active)]">
                <Icon name="check" size={14} />
                Image ready
              </p>
              <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]" title={value}>
                {fileLabel(value)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <SecondaryButton type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
                  <Icon name="upload" size={14} />
                  Replace
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={uploading}
                  className="text-[var(--bright-red)]"
                  onClick={clear}
                >
                  <Icon name="trash" size={14} />
                  Remove
                </SecondaryButton>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 px-3 text-center transition-colors duration-200 hover:bg-[var(--surface-hover)] disabled:opacity-50",
              compact ? "min-h-[132px] py-5" : "min-h-[140px] py-6",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-[12px] bg-[var(--card-bg)]",
                compact ? "size-11" : "size-12",
              )}
            >
              <UploadMark />
            </span>
            <div>
              <p className="text-[13px] font-medium leading-5">Drop image or click to browse</p>
              <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">
                PNG, JPG, WebP, GIF · max {MAX_MB}MB
              </p>
            </div>
          </button>
        )}
      </div>

      {onUrlChange ? (
        <div>
          <p className="mb-1.5 text-[12px] font-medium leading-[18px] text-[var(--text-muted)]">
            Or paste hosted URL
          </p>
          <TextInput
            value={value ?? ""}
            placeholder="https://cdn.example.com/recipes/pasta.jpg"
            onChange={(event) => onUrlChange(event.target.value.trim() || null)}
          />
        </div>
      ) : null}

      {displayError ? (
        <p className="flex items-center gap-1.5 text-[12px] leading-[18px] text-[var(--bright-red)]">
          <Icon name="warning" size={14} />
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
