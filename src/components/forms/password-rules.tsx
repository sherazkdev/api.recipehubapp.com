"use client";

import { useMemo } from "react";
import { PASSWORD_RULES } from "@/features/auth/services/password.service";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export function PasswordRules({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const rules = useMemo(
    () =>
      PASSWORD_RULES.map((rule) => ({
        ...rule,
        passed: rule.test(password),
      })),
    [password],
  );

  const match = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--page-bg)] p-3">
      <p className="mb-2 text-[12px] font-medium leading-[18px]">Password requirements</p>
      <ul className="flex flex-col gap-1.5">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 text-[12px] leading-[18px]",
              rule.passed ? "text-[var(--status-active)]" : "text-[var(--text-muted)]",
            )}
          >
            {rule.passed ? (
              <Icon name="check" size={12} />
            ) : (
              <span className="inline-block size-3 rounded-full border border-current" />
            )}
            {rule.label}
          </li>
        ))}
        <li
          className={cn(
            "flex items-center gap-2 text-[12px]",
            match ? "text-[var(--status-active)]" : mismatch ? "text-[var(--bright-red)]" : "text-[var(--text-muted)]",
          )}
        >
          {match ? (
            <Icon name="check" size={12} />
          ) : (
            <span className="inline-block size-3 rounded-full border border-current" />
          )}
          Passwords match
        </li>
      </ul>
    </div>
  );
}

export function isPasswordValid(password: string, confirmPassword: string) {
  const allRules = PASSWORD_RULES.every((rule) => rule.test(password));
  return allRules && password === confirmPassword;
}
