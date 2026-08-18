import { getAccessToken, hasSessionHint, setAccessToken, setSessionHint } from './auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Refresh when access JWT has < 2 minutes left. */
const ACCESS_REFRESH_SKEW_MS = 2 * 60 * 1000;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
  /** Extra attempt after a network failure (e.g. API mid-restart). Default 0. */
  networkRetries?: number;
};

let refreshPromise: Promise<string | null> | null = null;

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('load failed')
    );
  }
  return false;
}

function readJwtExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpiringSoon(
  token: string | null = getAccessToken(),
  skewMs = ACCESS_REFRESH_SKEW_MS,
): boolean {
  if (!token) return true;
  const exp = readJwtExpiryMs(token);
  if (exp == null) return true;
  return exp <= Date.now() + skewMs;
}

/**
 * Single-flight refresh using the httpOnly cookie.
 * All callers (apiFetch 401, AuthProvider, wizard pre-submit) must use this.
 * Skipped without a session hint so anonymous visitors never hit /auth/refresh;
 * pass `force` right after an OAuth redirect, where the cookie exists but the hint does not.
 */
export async function refreshAccessToken({ force = false } = {}): Promise<string | null> {
  if (!force && !hasSessionHint()) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let res: Response;
      try {
        res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Keep the hint: a network failure says nothing about the session.
        setAccessToken(null);
        return null;
      }
      if (!res.ok) {
        setAccessToken(null);
        setSessionHint(false);
        return null;
      }
      const data = (await res.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      setSessionHint(true);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Ensure we have a non-expired access token (refresh if missing or near expiry). */
export async function ensureAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (current && !isAccessTokenExpiringSoon(current)) {
    return current;
  }
  return refreshAccessToken();
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (isNetworkError(err)) {
      throw new ApiError(0, 'NETWORK');
    }
    throw err;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, skipRefresh = false, networkRetries = 0, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    let token = getAccessToken();
    if ((!token || isAccessTokenExpiringSoon(token)) && !skipRefresh) {
      token = await refreshAccessToken();
    }
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await rawFetch(path, {
      ...rest,
      headers: finalHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 0 && networkRetries > 0) {
      await new Promise((r) => setTimeout(r, 900));
      return apiFetch<T>(path, { ...options, networkRetries: networkRetries - 1 });
    }
    throw err;
  }

  if (response.status === 401 && auth && !skipRefresh && hasSessionHint()) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch<T>(path, { ...options, skipRefresh: true, networkRetries: 0 });
    }
  }

  if (!response.ok) {
    let message = '';
    try {
      const errorBody = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(errorBody.message)) {
        message = errorBody.message.join(', ');
      } else if (errorBody.message) {
        message = errorBody.message;
      }
    } catch {
      // ignore parse errors
    }
    if (!message) {
      if (response.status === 401) message = 'SESSION_EXPIRED';
      else message = 'GENERIC';
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
