export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN,
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
  return password.length <= PASSWORD_MAX && passwordScore(password) === 5;
}

/** English messages for API responses — keep in sync with getPasswordChecks. */
export function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN) errors.push('At least 8 characters');
  if (password.length > PASSWORD_MAX) errors.push('Password is too long');
  if (!/[A-Z]/.test(password)) errors.push('Uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Lowercase letter');
  if (!/\d/.test(password)) errors.push('Number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Special character');
  return errors;
}
