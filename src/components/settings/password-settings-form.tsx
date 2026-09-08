"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, PasswordInput } from "@/components/ui/fields";
import { PrimaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { isPasswordValid, PasswordRules } from "@/components/forms/password-rules";
import { ApiError, changePassword } from "@/lib/api-client";
import { clearAccessToken } from "@/lib/auth-session";
import { adminPath } from "@/lib/admin-path";

export function PasswordSettingsForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const valid = isPasswordValid(nextPassword, confirmPassword);

  return (
    <form
      className="mx-auto flex w-full max-w-[560px] flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSuccess("");
        if (!currentPassword || !nextPassword || !confirmPassword) {
          setError("All fields are required.");
          return;
        }
        if (!valid) {
          setError("New password does not meet all requirements.");
          return;
        }
        setError("");
        setLoading(true);
        void (async () => {
          try {
            await changePassword({
              currentPassword,
              newPassword: nextPassword,
              confirmPassword,
            });
            clearAccessToken();
            setSuccess("Password updated. Redirecting to sign in…");
            window.setTimeout(() => {
              router.replace(`${adminPath("/login")}?reason=password-changed`);
            }, 1200);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update password.");
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4 md:p-5">
        <h2 className="mb-4 text-[14px] font-semibold leading-5">Change password</h2>
        <div className="flex flex-col gap-4">
          <FormField label="Old password" required>
            <PasswordInput
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter old password"
              autoComplete="current-password"
            />
          </FormField>
          <FormField label="New password" required>
            <PasswordInput
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm password" required>
            <PasswordInput
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </FormField>
          <PasswordRules password={nextPassword} confirmPassword={confirmPassword} />
          {error ? (
            <p className="flex items-start gap-2 text-[12px] leading-[18px] text-[var(--bright-red)]">
              <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
          {success ? <p className="text-[12px] leading-[18px] text-[var(--status-active)]">{success}</p> : null}
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton type="submit" loading={loading} disabled={!valid}>
            Save Password
          </PrimaryButton>
        </div>
      </section>
    </form>
  );
}
