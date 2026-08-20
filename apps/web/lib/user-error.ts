import { ApiError } from '@/lib/api';

const RAW_HTTP =
  /^(ok|created|accepted|no content|bad request|unauthorized|forbidden|not found|conflict|unprocessable entity|too many requests|internal server error|bad gateway|service unavailable|gateway timeout|request failed|generic)$/i;

/** Backend strings we never show raw — mapped in `useErrorMessage`. */
export const API_MESSAGE_KEYS: Record<string, string> = {
  NETWORK: 'networkError',
  GENERIC: 'errorGeneric',
  SESSION_EXPIRED: 'sessionExpired',
  'Invalid email or password': 'invalidCredentials',
  'Account temporarily locked. Try again later.': 'accountLocked',
  'Email is already registered': 'emailTaken',
  'Current password is incorrect': 'currentPasswordWrong',
  'Invalid verification code': 'invalidCode',
  'Invalid or expired token': 'tokenExpired',
  FACEBOOK_PENDING_EXPIRED: 'oauthPendingExpired',
  PROVIDER_ALREADY_LINKED: 'oauthProviderLinked',
  'Refresh token missing': 'sessionExpired',
  'Invalid refresh token': 'sessionExpired',
  'You must accept the Privacy Policy and Terms of Service': 'termsRequired',
  'New password must be different from the current password': 'passwordDifferent',
};

export type UserErrorKind =
  'network' | 'session' | 'forbidden' | 'notFound' | 'rateLimit' | 'mapped' | 'message' | 'generic';

export function isRawHttpMessage(message: string): boolean {
  return !message.trim() || RAW_HTTP.test(message.trim());
}

export function classifyUserError(err: unknown): {
  kind: UserErrorKind;
  mapKey?: string;
  message?: string;
} {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.message === 'NETWORK') {
      return { kind: 'network', mapKey: 'networkError' };
    }
    const mapped =
      API_MESSAGE_KEYS[err.message] ??
      (err.message.startsWith('Password does not meet') ? 'passwordWeak' : undefined);
    if (mapped) {
      return { kind: 'mapped', mapKey: mapped, message: err.message };
    }
    if (isRawHttpMessage(err.message)) {
      if (err.status === 401) return { kind: 'session', mapKey: 'sessionExpired' };
      if (err.status === 403) return { kind: 'forbidden', mapKey: 'forbidden' };
      if (err.status === 404) return { kind: 'notFound', mapKey: 'notFound' };
      if (err.status === 429) return { kind: 'rateLimit', mapKey: 'rateLimited' };
      return { kind: 'generic', mapKey: 'errorGeneric' };
    }
    if (err.status === 401 && /sesioni skadoi|session expired/i.test(err.message)) {
      return { kind: 'session', mapKey: 'sessionExpired' };
    }
    return { kind: 'message', message: err.message };
  }

  if (err instanceof TypeError) return { kind: 'network', mapKey: 'networkError' };
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
      return { kind: 'network', mapKey: 'networkError' };
    }
  }
  return { kind: 'generic', mapKey: 'errorGeneric' };
}
