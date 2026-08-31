import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "One special character (@#$!%)",
    test: (p) => /[@#$!%]/.test(p),
  },
];

export function validatePassword(password: string) {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password));
  return {
    valid: failed.length === 0,
    rules: PASSWORD_RULES.map((rule) => ({
      ...rule,
      passed: rule.test(password),
    })),
    errors: failed.map((r) => r.label),
  };
}
