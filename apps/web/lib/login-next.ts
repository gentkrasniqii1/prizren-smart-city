const LOGIN_NEXT_KEY = 'psc.loginNext';
const INSTITUTION_REPORT_PATH = /^\/institution\/reports\/[A-Za-z0-9_-]{20,128}$/;

export function safeInstitutionLoginNext(value: string | null | undefined): string | null {
  if (!value) return null;
  let path = value;
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      path = new URL(value).pathname;
    }
  } catch {
    return null;
  }
  if (path.includes('//') || path.includes('?') || path.includes('#')) return null;
  if (!INSTITUTION_REPORT_PATH.test(path)) return null;
  return path;
}

export function rememberLoginNext(path: string) {
  const safe = safeInstitutionLoginNext(path);
  if (typeof sessionStorage === 'undefined') return;
  if (safe) sessionStorage.setItem(LOGIN_NEXT_KEY, safe);
  else sessionStorage.removeItem(LOGIN_NEXT_KEY);
}

export function consumeLoginNext(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = safeInstitutionLoginNext(sessionStorage.getItem(LOGIN_NEXT_KEY));
  sessionStorage.removeItem(LOGIN_NEXT_KEY);
  const fromQuery = safeInstitutionLoginNext(
    new URLSearchParams(window.location.search).get('next'),
  );
  return stored ?? fromQuery;
}
