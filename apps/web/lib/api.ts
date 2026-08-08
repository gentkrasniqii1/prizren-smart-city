import { getAccessToken, setAccessToken } from './auth-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, skipRefresh = false, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isFormData && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (response.status === 401 && auth && !skipRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  if (!response.ok) {
    let message = response.statusText;
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
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
