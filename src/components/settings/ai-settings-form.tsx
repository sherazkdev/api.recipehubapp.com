"use client";

import { useCallback, useEffect, useState } from "react";
import { FormField, NumberInput, PasswordInput, Select, Toggle } from "@/components/ui/fields";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { apiGet, apiPost, apiPut, ApiError } from "@/lib/api-client";
import type { AiSettings } from "@/features/settings/types";
import { GROQ_RECIPE_MODELS, GROQ_VISION_MODELS } from "@/features/settings/types";

type AiSettingsResponse = {
  ai: AiSettings & { groqApiKeyMasked?: string };
};

export function AiSettingsForm() {
  const [form, setForm] = useState<(AiSettings & { groqApiKeyMasked?: string }) | null>(null);
  const [groqApiKey, setGroqApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<AiSettingsResponse>("/api/admin/settings");
      setForm(data.ai);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !form) {
    return <div className="h-72 animate-pulse rounded-[16px] bg-[var(--black-05)]" />;
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
            const payload: Partial<AiSettings> = {
              recipeModel: form.recipeModel,
              visionModel: form.visionModel,
              defaultLanguage: form.defaultLanguage,
              maxRequestsPerMinute: form.maxRequestsPerMinute,
              maxScanImageMb: form.maxScanImageMb,
              foodOnlyMode: form.foodOnlyMode,
              includeNutrition: form.includeNutrition,
              minSteps: form.minSteps,
              maxSteps: form.maxSteps,
              imageSource: form.imageSource,
            };
            if (groqApiKey.trim()) payload.groqApiKey = groqApiKey.trim();
            await apiPut("/api/admin/settings", { section: "ai", data: payload });
            setGroqApiKey("");
            setSuccess("AI settings saved.");
            await load();
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to save AI settings");
          } finally {
            setSaving(false);
          }
        })();
      }}
    >
      <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
        <h2 className="mb-4 text-[14px] font-semibold leading-5">AI settings</h2>

        <FormField label="Groq API Key" hint={form.groqApiKeyMasked ? `Saved: ${form.groqApiKeyMasked}` : undefined}>
          <PasswordInput
            value={groqApiKey}
            onChange={(event) => setGroqApiKey(event.target.value)}
            placeholder="Enter a new Groq API key"
            autoComplete="off"
          />
        </FormField>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Recipe model">
            <Select
              value={form.recipeModel}
              onChange={(event) => setForm({ ...form, recipeModel: event.target.value })}
            >
              {GROQ_RECIPE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Vision model (scan)">
            <Select
              value={form.visionModel}
              onChange={(event) => setForm({ ...form, visionModel: event.target.value })}
            >
              {GROQ_VISION_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Default language">
            <Select
              value={form.defaultLanguage}
              onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })}
            >
              <option value="English">English</option>
              <option value="Urdu">Urdu</option>
              <option value="Hindi">Hindi</option>
              <option value="Arabic">Arabic</option>
            </Select>
          </FormField>
          <FormField label="Image source">
            <Select
              value={form.imageSource}
              onChange={(event) =>
                setForm({ ...form, imageSource: event.target.value as AiSettings["imageSource"] })
              }
            >
              <option value="pollinations">Pollinations auto</option>
              <option value="none">None</option>
            </Select>
          </FormField>
          <FormField label="Max requests per minute">
            <NumberInput
              min={1}
              value={form.maxRequestsPerMinute}
              onChange={(event) =>
                setForm({ ...form, maxRequestsPerMinute: Number(event.target.value) || 1 })
              }
            />
          </FormField>
          <FormField label="Max image size for scan (MB)">
            <NumberInput
              min={1}
              step={0.5}
              value={form.maxScanImageMb}
              onChange={(event) => setForm({ ...form, maxScanImageMb: Number(event.target.value) || 1 })}
            />
          </FormField>
          <FormField label="Min steps">
            <NumberInput
              min={1}
              value={form.minSteps}
              onChange={(event) => setForm({ ...form, minSteps: Number(event.target.value) || 1 })}
            />
          </FormField>
          <FormField label="Max steps">
            <NumberInput
              min={1}
              value={form.maxSteps}
              onChange={(event) => setForm({ ...form, maxSteps: Number(event.target.value) || 1 })}
            />
          </FormField>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-[12px] border border-[var(--border)] px-3 py-3">
            <span className="text-[14px] leading-5">Food-only mode</span>
            <Toggle
              checked={form.foodOnlyMode}
              onChange={(next) => setForm({ ...form, foodOnlyMode: next })}
              label={form.foodOnlyMode ? "ON" : "OFF"}
            />
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-[var(--border)] px-3 py-3">
            <span className="text-[14px] leading-5">Include nutrition</span>
            <Toggle
              checked={form.includeNutrition}
              onChange={(next) => setForm({ ...form, includeNutrition: next })}
              label={form.includeNutrition ? "ON" : "OFF"}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              type="button"
              disabled={testing}
              onClick={() => {
                setTesting(true);
                setTestMessage("");
                setTestOk(null);
                void (async () => {
                  try {
                    const result = await apiPost<{ ok: boolean; message: string; latencyMs?: number }>(
                      "/api/admin/settings/test-groq",
                      {
                        groqApiKey: groqApiKey.trim() || undefined,
                        recipeModel: form.recipeModel,
                      },
                    );
                    setTestOk(result.ok);
                    setTestMessage(
                      result.ok
                        ? `${result.message}${result.latencyMs ? ` (${result.latencyMs} ms)` : ""}`
                        : result.message,
                    );
                  } catch (err) {
                    setTestOk(false);
                    setTestMessage(err instanceof ApiError ? err.message : "Connection failed");
                  } finally {
                    setTesting(false);
                  }
                })();
              }}
            >
              Test Groq Connection
            </SecondaryButton>
            {testOk === true ? (
              <span className="inline-flex items-center gap-1 text-[13px] text-[var(--status-active)]">
                <Icon name="check" size={14} />
                {testMessage}
              </span>
            ) : null}
            {testOk === false ? (
              <span className="inline-flex items-center gap-1 text-[13px] text-[var(--bright-red)]">
                <Icon name="warning" size={14} />
                {testMessage}
              </span>
            ) : null}
          </div>
          <PrimaryButton type="submit" loading={saving} loadingLabel="Saving…">
            Save AI Settings
          </PrimaryButton>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-[var(--bright-red)]/25 bg-[var(--bright-red)]/10 px-4 py-3 text-[13px] text-[var(--bright-red)]">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? <p className="text-[13px] leading-5 text-[var(--status-active)]">{success}</p> : null}
    </form>
  );
}
