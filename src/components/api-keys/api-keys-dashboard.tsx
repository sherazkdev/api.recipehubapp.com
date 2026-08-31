"use client";

import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DangerButton, IconButton, PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { FormField, SearchInput, Select, TextInput } from "@/components/ui/fields";
import { Thumb } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { apiDelete, apiGet, apiPost, ApiError, refreshAccessToken } from "@/lib/api-client";
import { getAccessToken, redirectToAdminLogin, setAccessToken, subscribeAccessToken } from "@/lib/auth-session";
import { relativeTime } from "@/lib/relative-time";
import { adminPath } from "@/lib/admin-path";

const PAGE_SIZE = 8;
const ENVIRONMENTS = ["Production", "Staging", "Testing", "Internal"] as const;
type Environment = (typeof ENVIRONMENTS)[number];
type StatusFilter = "all" | "active" | "revoked";
type SortKey = "used" | "newest" | "oldest" | "name";

type ApiKeyItem = {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type ApiKeyCreated = ApiKeyItem & { key: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readJwtMeta(token: string | null) {
  if (!token) return { exp: null as number | null, iat: null as number | null };
  try {
    const part = token.split(".")[1];
    if (!part) return { exp: null, iat: null };
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { exp?: number; iat?: number };
    return {
      exp: typeof json.exp === "number" ? json.exp : null,
      iat: typeof json.iat === "number" ? json.iat : null,
    };
  } catch {
    return { exp: null, iat: null };
  }
}

function formatCountdown(exp: number | null, now = Date.now()) {
  if (!exp) return "—";
  const left = exp * 1000 - now;
  if (left <= 0) return "Expired";
  const total = Math.floor(left / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function truncateJwt(token: string) {
  if (token.length <= 28) return token;
  return `${token.slice(0, 24)}…`;
}

function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--modal-overlay)]"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[420px] rounded-t-[16px] bg-[var(--modal-bg)] p-5 shadow-[var(--shadow-xs)] sm:rounded-[16px] sm:p-6"
      >
        <h2 id={titleId} className="text-[14px] font-semibold leading-5">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function ApiKeysDashboard() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<Environment | "">("");
  const [envById, setEnvById] = useState<Record<string, Environment>>({});
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<ApiKeyCreated | null>(null);
  const accessToken = useSyncExternalStore(subscribeAccessToken, getAccessToken, () => null);
  const [jwtVisible, setJwtVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [envFilter, setEnvFilter] = useState<"all" | Environment>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const filterKey = `${query}\0${statusFilter}\0${envFilter}\0${sort}`;
  const [pageForKey, setPageForKey] = useState(filterKey);
  const [viewing, setViewing] = useState<ApiKeyItem | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKeyItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const swaggerUrl = "/api/docs";
  const jwtMeta = useMemo(() => readJwtMeta(accessToken), [accessToken]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setKeys(await apiGet<ApiKeyItem[]>("/api/admin/api-keys"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load API keys.");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Clipboard copy failed");
    }
  }

  const activeCount = keys.filter((key) => key.isActive !== false).length;
  const lastUsed = keys
    .map((key) => key.lastUsedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => +new Date(b) - +new Date(a))[0];
  const lastCreated = keys
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.createdAt;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let next = keys.filter((key) => {
      if (q && !key.name.toLowerCase().includes(q) && !key.prefix.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "active" && key.isActive === false) return false;
      if (statusFilter === "revoked" && key.isActive !== false) return false;
      if (envFilter !== "all" && envById[key.id] !== envFilter) return false;
      return true;
    });
    next = next.slice().sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "oldest") return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === "used") {
        return +new Date(b.lastUsedAt ?? 0) - +new Date(a.lastUsedAt ?? 0);
      }
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return next;
  }, [envById, envFilter, keys, query, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(pageForKey === filterKey ? page : 1, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  function goToPage(next: number) {
    setPageForKey(filterKey);
    setPage(next);
  }

  async function handleGenerate() {
    if (!name.trim()) {
      setError("API name is required");
      document.getElementById("api-key-name")?.focus();
      return;
    }
    setCreating(true);
    setError("");
    try {
      const item = await apiPost<ApiKeyCreated>("/api/admin/api-keys", { name: name.trim() });
      if (environment) {
        setEnvById((current) => ({ ...current, [item.id]: environment }));
      }
      setGenerated(item);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setBusyId(revokeTarget.id);
    try {
      await apiDelete(`/api/admin/api-keys?id=${revokeTarget.id}`);
      setRevokeTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Revoke failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotate() {
    if (!rotateTarget) return;
    setBusyId(rotateTarget.id);
    try {
      const item = await apiPost<ApiKeyCreated>("/api/admin/api-keys", { name: rotateTarget.name });
      const env = envById[rotateTarget.id] ?? environment;
      if (env) setEnvById((current) => ({ ...current, [item.id]: env }));
      await apiDelete(`/api/admin/api-keys?id=${rotateTarget.id}`);
      setRotateTarget(null);
      setGenerated(item);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Rotate failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 pb-8">
      <div>
        <h1 className="text-[18px] font-semibold leading-7 tracking-tight">API Keys</h1>
        <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">
          Use an x-api-key for Swagger and scripts. Bearer JWT is for this admin session.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KeyStat icon="password" label="Total Keys" value={loading ? "—" : String(keys.length)} hint="Generated for this admin" />
        <KeyStat
          icon="check"
          label="Active Keys"
          value={loading ? "—" : String(activeCount)}
          hint={keys.length ? `${Math.round((activeCount / keys.length) * 100)}% of total keys` : "No keys yet"}
        />
        <KeyStat
          icon="broadcast"
          label="Keys used"
          value={loading ? "—" : String(keys.filter((key) => key.lastUsedAt).length)}
          hint={lastUsed ? `Last activity ${relativeTime(lastUsed)}` : "No usage recorded yet"}
        />
        <KeyStat
          icon="history"
          label="Last Rotation"
          value={lastCreated ? formatDate(lastCreated) : "—"}
          hint={lastCreated ? `Latest key ${relativeTime(lastCreated)}` : "No keys generated"}
        />
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[rgb(255_71_71/0.25)] bg-[rgb(255_71_71/0.08)] px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <span className="inline-flex items-start gap-2">
            <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
            {error}
          </span>
          <SecondaryButton type="button" onClick={() => void load()}>
            Try again
          </SecondaryButton>
        </div>
      ) : null}

      <section className="wl-enter rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="password" size={16} />
              <h2 className="text-[14px] font-semibold leading-5">x-api-key</h2>
            </div>
            <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">
              Create and manage API keys for programmatic access.
            </p>
          </div>
          <p className="inline-flex items-start gap-1.5 rounded-[8px] bg-[var(--pastel-blue)] px-3 py-2 text-[12px] leading-[18px] text-[var(--static-black)]">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            Keep your keys secure and never expose them publicly.
          </p>
        </div>

        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void handleGenerate();
          }}
        >
          <FormField label="API name" required htmlFor="api-key-name">
            <TextInput
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Swagger testing"
              autoComplete="off"
            />
          </FormField>
          <FormField label="Environment" htmlFor="api-key-environment">
            <Select
              id="api-key-environment"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as Environment | "")}
            >
              <option value="">Not set</option>
              {ENVIRONMENTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormField>
          <PrimaryButton type="submit" loading={creating} className="h-9 w-full gap-1.5 lg:mt-[22px] lg:w-auto">
            <Icon name="password" size={14} />
            Generate key
          </PrimaryButton>
        </form>

        <div className="mt-5 flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchInput
            className="w-full min-w-0 lg:max-w-[240px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys by name..."
            aria-label="Search keys by name"
          />
          <Select
            aria-label="Filter by environment"
            value={envFilter}
            onChange={(event) => setEnvFilter(event.target.value as "all" | Environment)}
          >
            <option value="all">All Environments</option>
            {ENVIRONMENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </Select>
          <Select aria-label="Sort keys" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="used">Last used</option>
            <option value="newest">Recently created</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </Select>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-[10px] bg-[var(--black-05)]" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
                <Icon name="password" size={18} />
              </div>
              <p className="text-[14px] font-semibold leading-5">No API keys yet</p>
              <p className="mt-1 max-w-sm text-[13px] leading-5 text-[var(--text-muted)]">
                Generate your first API key to use Swagger or external scripts.
              </p>
              <PrimaryButton type="button" className="mt-4" onClick={() => document.getElementById("api-key-name")?.focus()}>
                Generate API Key
              </PrimaryButton>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">No keys match these filters.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0">
                  <thead>
                    <tr className="typo-table-head">
                      <th className="px-3 py-2 text-left font-normal">Key name</th>
                      <th className="px-3 py-2 text-left font-normal">API key</th>
                      <th className="hidden px-3 py-2 text-left font-normal lg:table-cell">Environment</th>
                      <th className="px-3 py-2 text-left font-normal">Status</th>
                      <th className="hidden px-3 py-2 text-left font-normal xl:table-cell">Scopes</th>
                      <th className="hidden px-3 py-2 text-left font-normal lg:table-cell">Last used</th>
                      <th className="hidden px-3 py-2 text-left font-normal xl:table-cell">Created</th>
                      <th className="w-[132px] px-3 py-2 text-right font-normal">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((key) => (
                      <tr key={key.id} className="typo-table-body border-t border-[var(--border)]">
                        <td className="px-3 py-3">
                          <NameCell name={key.name} prefix={key.prefix} />
                        </td>
                        <td className="px-3 py-3">
                          <MaskedKey
                            prefix={key.prefix}
                            revealed={revealedId === key.id}
                            onToggle={() => setRevealedId((id) => (id === key.id ? null : key.id))}
                          />
                        </td>
                        <td className="hidden px-3 py-3 lg:table-cell">
                          <EnvBadge value={envById[key.id]} />
                        </td>
                        <td className="px-3 py-3">
                          <StatusDot active={key.isActive !== false} />
                        </td>
                        <td className="hidden px-3 py-3 text-[12px] text-[var(--text-muted)] xl:table-cell">—</td>
                        <td className="hidden px-3 py-3 text-[12px] text-[var(--text-muted)] lg:table-cell">
                          {key.lastUsedAt ? relativeTime(key.lastUsedAt) : "Never"}
                        </td>
                        <td className="hidden px-3 py-3 text-[var(--text-muted)] xl:table-cell">
                          {formatDate(key.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <KeyActions
                            copied={copied === `row-${key.id}`}
                            canRevoke={key.isActive !== false}
                            onView={() => setViewing(key)}
                            onCopy={() => void copyText(`row-${key.id}`, key.prefix)}
                            onRotate={() => setRotateTarget(key)}
                            onRevoke={() => setRevokeTarget(key)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="flex flex-col gap-2 md:hidden">
                {pageRows.map((key) => (
                  <li key={key.id} className="rounded-[12px] bg-[var(--page-bg)] p-3">
                    <NameCell name={key.name} prefix={key.prefix} />
                    <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                      <EnvBadge value={envById[key.id]} />
                      <StatusDot active={key.isActive !== false} />
                    </div>
                    <p className="mt-3 text-[12px] text-[var(--text-muted)]">Key</p>
                    <MaskedKey
                      prefix={key.prefix}
                      revealed={revealedId === key.id}
                      onToggle={() => setRevealedId((id) => (id === key.id ? null : key.id))}
                    />
                    <div className="mt-3">
                      <KeyActions
                        copied={copied === `row-${key.id}`}
                        canRevoke={key.isActive !== false}
                        onView={() => setViewing(key)}
                        onCopy={() => void copyText(`row-${key.id}`, key.prefix)}
                        onRotate={() => setRotateTarget(key)}
                        onRevoke={() => setRevokeTarget(key)}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                <span>
                  Showing {from} to {to} of {filtered.length} keys
                </span>
                <div className="flex items-center gap-1">
                  <IconButton type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => goToPage(Math.max(1, safePage - 1))}>
                    <Icon name="caretLeft" size={14} />
                  </IconButton>
                  <span>
                    {safePage} / {pageCount}
                  </span>
                  <IconButton type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => goToPage(Math.min(pageCount, safePage + 1))}>
                    <Icon name="caretRight" size={14} />
                  </IconButton>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
          <h2 className="text-[14px] font-semibold leading-5">Bearer JWT (Admin Session)</h2>
          <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">
            Used for this admin session and dashboard access.
          </p>
          {loading ? (
            <div className="mt-4 h-16 animate-pulse rounded-[10px] bg-[var(--black-05)]" />
          ) : (
            <>
              <div className="relative mt-4 rounded-[10px] bg-[var(--page-bg)] px-3 py-2 font-mono text-[12px]">
                {accessToken
                  ? jwtVisible
                    ? truncateJwt(accessToken)
                    : `${accessToken.slice(0, 8)}…${accessToken.slice(-6)}`
                  : "Not signed in"}
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-label={jwtVisible ? "Hide JWT" : "Show JWT"}
                  onClick={() => setJwtVisible((value) => !value)}
                >
                  <Icon name={jwtVisible ? "eyeSlash" : "eye"} size={14} />
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Meta label="Expires in" value={formatCountdown(jwtMeta.exp, now)} />
                <Meta
                  label="Issued at"
                  value={jwtMeta.iat ? formatDateTime(new Date(jwtMeta.iat * 1000).toISOString()) : "—"}
                />
                <Meta label="Session IP" value="—" />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton type="button" disabled={!accessToken} onClick={() => accessToken && void copyText("jwt", accessToken)}>
                  {copied === "jwt" ? "Copied" : "Copy JWT"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  disabled={refreshing}
                  onClick={() => {
                    setRefreshing(true);
                    void (async () => {
                      try {
                        const token = await refreshAccessToken();
                        setAccessToken(token);
                      } catch (err) {
                        if (err instanceof ApiError && err.status === 401) {
                          redirectToAdminLogin();
                          return;
                        }
                        setError(err instanceof Error ? err.message : "Refresh failed");
                      } finally {
                        setRefreshing(false);
                      }
                    })();
                  }}
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </SecondaryButton>
                <a
                  href={swaggerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center rounded-[8px] border border-[var(--border)] px-3 text-[13px] hover:bg-[var(--surface-hover)]"
                >
                  Open Swagger
                </a>
                <SecondaryButton type="button" onClick={() => setSessionOpen(true)}>
                  Session Info
                </SecondaryButton>
              </div>
            </>
          )}
        </section>

        <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
          <h2 className="text-[14px] font-semibold leading-5">Usage &amp; Security</h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Meta label="Rate limits" value="See System Status" />
            <Meta label="IP restrictions" value="No restrictions configured" />
            <Meta label="Last activity" value={lastUsed ? relativeTime(lastUsed) : "No usage yet"} />
            <Meta label="Key rotation" value="Rotate production keys periodically." />
          </dl>
          <p className="mt-4 text-[12px] leading-[18px] text-[var(--text-muted)]">
            Full secrets are shown once at create/rotate. Prefer Bearer JWT in the admin UI and x-api-key only for
            scripts.
          </p>
          <a href={adminPath("/settings/system")} className="mt-3 inline-flex text-[12px] text-[var(--bright-purple)] hover:underline">
            Open system status
          </a>
        </section>
      </div>

      <Dialog open={Boolean(generated)} title="API key generated" onClose={() => setGenerated(null)}>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
          Copy this key now. For security reasons, you may not be able to view the full key again.
        </p>
        <code className="mt-3 block break-all rounded-[8px] bg-[var(--page-bg)] p-3 font-mono text-[12px]">
          {generated?.key}
        </code>
        <div className="mt-4 flex gap-2">
          <PrimaryButton type="button" className="flex-1" onClick={() => generated && void copyText("generated", generated.key)}>
            {copied === "generated" ? "Copied" : "Copy"}
          </PrimaryButton>
          <SecondaryButton type="button" className="flex-1" onClick={() => setGenerated(null)}>
            Done
          </SecondaryButton>
        </div>
      </Dialog>

      <Dialog open={Boolean(viewing)} title={viewing?.name ?? "API key"} onClose={() => setViewing(null)}>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
          The full secret is only shown once when the key is created or rotated.
        </p>
        <code className="mt-3 block break-all rounded-[8px] bg-[var(--page-bg)] p-3 font-mono text-[12px]">
          {viewing?.prefix}…
        </code>
        <div className="mt-4 flex gap-2">
          <SecondaryButton type="button" className="flex-1" onClick={() => viewing && void copyText("view", viewing.prefix)}>
            {copied === "view" ? "Copied" : "Copy prefix"}
          </SecondaryButton>
          <SecondaryButton type="button" className="flex-1" onClick={() => setViewing(null)}>
            Close
          </SecondaryButton>
        </div>
      </Dialog>

      <Dialog open={Boolean(rotateTarget)} title="Rotate API key?" onClose={() => setRotateTarget(null)}>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
          A new key will be created with the same name and the previous key will be revoked. Copy the new secret immediately.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setRotateTarget(null)} disabled={busyId !== null}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" loading={busyId === rotateTarget?.id} onClick={() => void handleRotate()}>
            Rotate
          </PrimaryButton>
        </div>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} title="Revoke API key?" onClose={() => setRevokeTarget(null)}>
        <p className="mt-2 text-[13px] leading-5 text-[var(--text-muted)]">
          Applications using this key may immediately lose API access.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setRevokeTarget(null)} disabled={busyId !== null}>
            Cancel
          </SecondaryButton>
          <DangerButton type="button" disabled={busyId === revokeTarget?.id} onClick={() => void handleRevoke()}>
            {busyId === revokeTarget?.id ? "Revoking…" : "Revoke"}
          </DangerButton>
        </div>
      </Dialog>

      <Dialog open={sessionOpen} title="Session info" onClose={() => setSessionOpen(false)}>
        <dl className="mt-3 grid grid-cols-1 gap-3">
          <Meta label="Expires in" value={formatCountdown(jwtMeta.exp, now)} />
          <Meta label="Issued at" value={jwtMeta.iat ? formatDateTime(new Date(jwtMeta.iat * 1000).toISOString()) : "—"} />
          <Meta label="Token type" value="Bearer access" />
        </dl>
        <div className="mt-4 flex justify-end">
          <SecondaryButton type="button" onClick={() => setSessionOpen(false)}>
            Close
          </SecondaryButton>
        </div>
      </Dialog>
    </div>
  );
}

function KeyStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: "password" | "check" | "broadcast" | "history";
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[14px] border border-[var(--border)] bg-[var(--card-bg)] px-3 py-3 md:px-4">
      <div className="mb-2 flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
        <Icon name={icon} size={14} />
      </div>
      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold leading-7 tracking-tight">{value}</p>
      <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{hint}</p>
    </article>
  );
}

function NameCell({ name, prefix }: { name: string; prefix: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Thumb label={name} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] leading-5">{name}</span>
        <span className="block truncate font-mono text-[11px] text-[var(--text-muted)]">{prefix}…</span>
      </span>
    </span>
  );
}

function MaskedKey({
  prefix,
  revealed,
  onToggle,
}: {
  prefix: string;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[12px]">
      <span className="max-w-[140px] truncate">{revealed ? `${prefix}…` : "••••••••••••••••"}</span>
      <IconButton type="button" aria-label={revealed ? "Hide key prefix" : "Show key prefix"} onClick={onToggle}>
        <Icon name={revealed ? "eyeSlash" : "eye"} size={14} />
      </IconButton>
    </span>
  );
}

function EnvBadge({ value }: { value?: Environment }) {
  if (!value) return <span className="text-[12px] text-[var(--text-muted)]">—</span>;
  const tone =
    value === "Production"
      ? "bg-[rgb(161_227_203/0.22)]"
      : value === "Staging"
        ? "bg-[rgb(227_245_255/0.8)]"
        : value === "Testing"
          ? "bg-[rgb(255_233_153/0.35)]"
          : "bg-[rgb(229_236_246/0.9)]";
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] text-[var(--static-black)]", tone)}>
      {value}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px]">
      <span
        className="size-1.5 rounded-full"
        style={{ background: active ? "var(--status-active)" : "var(--bright-red)" }}
      />
      {active ? "Active" : "Revoked"}
    </span>
  );
}

function KeyActions({
  copied,
  canRevoke,
  onView,
  onCopy,
  onRotate,
  onRevoke,
}: {
  copied: boolean;
  canRevoke: boolean;
  onView: () => void;
  onCopy: () => void;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton type="button" className="size-8 md:size-7" aria-label="View key" title="View" onClick={onView}>
        <Icon name="eye" size={14} />
      </IconButton>
      <IconButton type="button" className="size-8 md:size-7" aria-label="Copy key prefix" title={copied ? "Copied" : "Copy"} onClick={onCopy}>
        <Icon name={copied ? "check" : "copy"} size={14} />
      </IconButton>
      <IconButton type="button" className="size-8 md:size-7" aria-label="Rotate key" title="Rotate" disabled={!canRevoke} onClick={onRotate}>
        <Icon name="history" size={14} />
      </IconButton>
      <IconButton type="button" className="size-8 md:size-7" aria-label="Revoke key" title="Revoke" disabled={!canRevoke} onClick={onRevoke}>
        <Icon name="trash" size={14} />
      </IconButton>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] leading-[18px] text-[var(--text-muted)]">{label}</dt>
      <dd className="text-[13px] leading-5">{value}</dd>
    </div>
  );
}
