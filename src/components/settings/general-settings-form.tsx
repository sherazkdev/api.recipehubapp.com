"use client";

import { useCallback, useEffect, useState } from "react";
import { FormField, Select, TextArea, TextInput, Toggle } from "@/components/ui/fields";
import { PrimaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { apiGet, apiPut, ApiError } from "@/lib/api-client";
import type { GeneralSettings } from "@/features/settings/types";

type SettingsResponse = {
  general: GeneralSettings;
};

export function GeneralSettingsForm() {
  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<SettingsResponse>("/api/admin/settings");
      setForm(data.general);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !form) {
    return <div className="h-64 animate-pulse rounded-[16px] bg-[var(--black-05)]" />;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        void (async () => {
          try {
            await apiPut("/api/admin/settings", { section: "general", data: form });
            setSuccess("General settings saved.");
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to save settings");
          } finally {
            setSaving(false);
          }
        })();
      }}
    >
      <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
        <h2 className="mb-4 text-[14px] font-semibold leading-5">General settings</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="App name" required>
            <TextInput
              value={form.appName}
              onChange={(event) => setForm({ ...form, appName: event.target.value })}
            />
          </FormField>
          <FormField label="Support email" required>
            <TextInput
              type="email"
              value={form.supportEmail}
              onChange={(event) => setForm({ ...form, supportEmail: event.target.value })}
            />
          </FormField>
          <FormField label="Default language" className="md:col-span-2">
            <Select
              value={form.defaultLanguage}
              onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })}
            >
              <option value="en">English</option>
              <option value="ur">Urdu</option>
              <option value="hi">Hindi</option>
              <option value="ar">Arabic</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-medium leading-5">Maintenance mode</p>
            <p className="text-[13px] leading-5 text-[var(--text-muted)]">
              Temporarily pause access to the app.
            </p>
          </div>
          <Toggle
            checked={form.maintenanceMode}
            onChange={(next) => setForm({ ...form, maintenanceMode: next })}
            label={form.maintenanceMode ? "ON" : "OFF"}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <FormField label="Maintenance message">
            <TextArea
              value={form.maintenanceMessage}
              onChange={(event) => setForm({ ...form, maintenanceMessage: event.target.value })}
            />
          </FormField>
          <FormField
            label="Allowed IPs (optional)"
            hint="Comma-separated IPs that can still access the API during maintenance."
          >
            <TextInput
              value={form.allowedIps}
              onChange={(event) => setForm({ ...form, allowedIps: event.target.value })}
              placeholder="e.g. 203.0.113.10, 198.51.100.2"
            />
          </FormField>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[var(--bright-red)]/25 bg-[var(--bright-red)]/10 px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <p className="text-[13px] leading-5 text-[var(--status-active)]">{success}</p>
      ) : null}

      <div className="flex justify-end">
        <PrimaryButton type="submit" loading={saving} loadingLabel="Saving…">
          Save General Settings
        </PrimaryButton>
      </div>
    </form>
  );
}
