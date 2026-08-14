export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function passwordScore(password: string): number {
  const checks = getPasswordChecks(password);
  return Object.values(checks).filter(Boolean).length;
}

export function isPasswordStrong(password: string): boolean {
  return passwordScore(password) === 5;
}
