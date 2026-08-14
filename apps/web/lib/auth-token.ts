/** Set alongside the httpOnly refresh cookie, which JS cannot read. */
const SESSION_HINT_KEY = 'psc.session';

let accessToken: string | null = null;
/** Fallback for this tab when storage is unavailable (private mode, blocked cookies). */
let sessionHint = false;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** True when this browser has a refresh session worth trying to refresh. */
export function hasSessionHint(): boolean {
  if (sessionHint) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint(active: boolean): void {
  sessionHint = active;
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    // storage blocked; the in-memory flag still covers this tab
  }
}
