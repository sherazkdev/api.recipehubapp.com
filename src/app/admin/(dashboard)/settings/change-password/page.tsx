"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, PasswordInput } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { PrimaryButton } from "@/components/ui/buttons";
import { isPasswordValid, PasswordRules } from "@/components/forms/password-rules";
import { ApiError, changePassword } from "@/lib/api-client";
import { clearAccessToken } from "@/lib/auth-session";
import { adminPath } from "@/lib/admin-path";

export default function ChangePasswordPage() {
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
      className="mx-auto flex w-full max-w-[520px] flex-col gap-5"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[14px] font-semibold leading-5">Change Password</h1>
        <PrimaryButton type="submit" loading={loading} disabled={!valid} className="w-full sm:w-auto">
          Update Password
        </PrimaryButton>
      </div>
      <div className="overflow-hidden rounded-[16px] bg-[var(--card-bg)]">
        <FormSection title="Credentials">
          <FormField label="Current Password" required>
            <PasswordInput
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label="New Password" required>
            <PasswordInput
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm New Password" required>
            <PasswordInput
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <PasswordRules password={nextPassword} confirmPassword={confirmPassword} />
          {error ? <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{error}</p> : null}
          {success ? <p className="text-[12px] leading-[18px] text-[var(--status-active)]">{success}</p> : null}
        </FormSection>
      </div>
    </form>
  );
}
