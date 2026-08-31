"use client";

import type { ReactNode, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";

export function FormPage({
  title,
  subtitle,
  backHref,
  backLabel,
  submitLabel,
  loadingLabel = "Saving…",
  wide = false,
  fullWidth = false,
  ungrouped = false,
  loading = false,
  error,
  headerExtra,
  onSubmit,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  submitLabel: string;
  loadingLabel?: string;
  wide?: boolean;
  fullWidth?: boolean;
  ungrouped?: boolean;
  loading?: boolean;
  error?: string;
  headerExtra?: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
}) {
  const router = useRouter();

  const actions = (
    <>
      <SecondaryButton type="button" disabled={loading} onClick={() => router.push(backHref)}>
        Cancel
      </SecondaryButton>
      <PrimaryButton type="submit" loading={loading} loadingLabel={loadingLabel}>
        {submitLabel}
      </PrimaryButton>
    </>
  );

  return (
    <form
      className={cn(
        "mx-auto flex w-full flex-col gap-3 pb-24",
        fullWidth ? "max-w-[1100px]" : wide ? "max-w-[920px]" : "max-w-[720px]",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (onSubmit) {
          void onSubmit(event);
          return;
        }
        router.push(backHref);
      }}
    >
      <div className="shrink-0 rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 md:px-5">
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-[12px] leading-[18px] text-[var(--text-muted)] hover:text-ink"
        >
          <Icon name="caretLeft" size={12} />
          {backLabel}
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold leading-7 tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">{subtitle}</p> : null}
            {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
          </div>
          <div className="hidden shrink-0 flex-wrap items-center gap-2 lg:flex">{actions}</div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] leading-5 text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-4",
          !ungrouped &&
            "rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 shadow-[var(--shadow-xs)] md:p-5",
        )}
      >
        {children}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-2">
          <SecondaryButton
            type="button"
            className="flex-1"
            disabled={loading}
            onClick={() => router.push(backHref)}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" loading={loading} loadingLabel={loadingLabel} className="flex-1">
            {submitLabel}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}

export function slugFromName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function DataUtilityPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
    </div>
  );
}
