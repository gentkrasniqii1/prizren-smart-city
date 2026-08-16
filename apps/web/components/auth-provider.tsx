'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthResponse,
  LoginRequest,
  LoginResponse,
  PublicUser,
  RegisterRequest,
  RegisterResponse,
} from '@prizren/shared-types';
import {
  apiFetch,
  ensureAccessToken,
  isAccessTokenExpiringSoon,
  refreshAccessToken,
} from '@/lib/api';
import { getAccessToken, hasSessionHint, setAccessToken, setSessionHint } from '@/lib/auth-token';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (
    payload: LoginRequest,
  ) => Promise<{ requiresTwoFactor: true; challengeToken: string } | void>;
  register: (payload: RegisterRequest) => Promise<RegisterResponse>;
  completeTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Patch the cached user locally after a profile mutation (avoids a refetch). */
  updateUser: (user: PublicUser) => void;
  /** `force` refreshes even without a stored session hint (OAuth callback). */
  refreshSession: (options?: { force?: boolean }) => Promise<boolean>;
  /** Refresh access token if missing/near expiry; keeps user logged in when possible. */
  ensureSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const proactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearProactiveRefresh = useCallback(() => {
    if (proactiveTimer.current) {
      clearTimeout(proactiveTimer.current);
      proactiveTimer.current = null;
    }
  }, []);

  const scheduleProactiveRefresh = useCallback(() => {
    clearProactiveRefresh();
    const token = getAccessToken();
    if (!token) return;

    try {
      const part = token.split('.')[1];
      if (!part) return;
      const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
        exp?: number;
      };
      if (typeof payload.exp !== 'number') return;
      // Refresh ~2 minutes before expiry (min 5s from now)
      const delay = Math.max(5_000, payload.exp * 1000 - Date.now() - 120_000);
      proactiveTimer.current = setTimeout(() => {
        void (async () => {
          const next = await refreshAccessToken();
          if (next) {
            scheduleProactiveRefresh();
          } else {
            setUser(null);
          }
        })();
      }, delay);
    } catch {
      // ignore malformed token
    }
  }, [clearProactiveRefresh]);

  const loadMe = useCallback(async () => {
    const me = await apiFetch<PublicUser>('/users/me', {
      auth: true,
      skipRefresh: true,
    });
    setUser(me);
    scheduleProactiveRefresh();
    return me;
  }, [scheduleProactiveRefresh]);

  const refreshSession = useCallback(
    async ({ force = false } = {}) => {
      // Always go through the shared single-flight refresh (avoids cookie rotation races)
      const accessToken = await refreshAccessToken({ force });
      if (!accessToken) {
        setUser(null);
        clearProactiveRefresh();
        return false;
      }
      try {
        await loadMe();
        return true;
      } catch {
        setAccessToken(null);
        setUser(null);
        clearProactiveRefresh();
        return false;
      }
    },
    [loadMe, clearProactiveRefresh],
  );

  const ensureSession = useCallback(async () => {
    const token = await ensureAccessToken();
    if (!token) {
      setUser(null);
      clearProactiveRefresh();
      return false;
    }
    if (!user || isAccessTokenExpiringSoon(token, 0)) {
      try {
        await loadMe();
      } catch {
        // Token may still be valid for submit; keep going if we have one
        if (!getAccessToken()) {
          setUser(null);
          return false;
        }
      }
    } else {
      scheduleProactiveRefresh();
    }
    return true;
  }, [user, loadMe, scheduleProactiveRefresh, clearProactiveRefresh]);

  useEffect(() => {
    // Anonymous visitors have no session to restore — public pages must not call /auth/refresh.
    if (!hasSessionHint()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      await refreshSession();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      clearProactiveRefresh();
    };
    // Mount-only: shared refreshAccessToken mutex absorbs Strict Mode double-invoke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: payload,
        skipRefresh: true,
      });
      if ('requiresTwoFactor' in data && data.requiresTwoFactor) {
        return { requiresTwoFactor: true as const, challengeToken: data.challengeToken };
      }
      const auth = data as AuthResponse;
      setAccessToken(auth.accessToken);
      setSessionHint(true);
      setUser(auth.user);
      scheduleProactiveRefresh();
    },
    [scheduleProactiveRefresh],
  );

  const completeTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      const data = await apiFetch<AuthResponse>('/auth/2fa/verify', {
        method: 'POST',
        body: { challengeToken, code },
        skipRefresh: true,
      });
      setAccessToken(data.accessToken);
      setSessionHint(true);
      setUser(data.user);
      scheduleProactiveRefresh();
    },
    [scheduleProactiveRefresh],
  );

  const register = useCallback(async (payload: RegisterRequest) => {
    return apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      skipRefresh: true,
    });
  }, []);

  const logout = useCallback(async () => {
    clearProactiveRefresh();
    try {
      if (getAccessToken()) {
        await apiFetch<{ ok: boolean }>('/auth/logout', {
          method: 'POST',
          auth: true,
          skipRefresh: true,
        });
      }
    } finally {
      setAccessToken(null);
      setSessionHint(false);
      setUser(null);
    }
  }, [clearProactiveRefresh]);

  const updateUser = useCallback((next: PublicUser) => {
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      completeTwoFactor,
      logout,
      updateUser,
      refreshSession,
      ensureSession,
    }),
    [
      user,
      loading,
      login,
      register,
      completeTwoFactor,
      logout,
      updateUser,
      refreshSession,
      ensureSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
