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
  PublicUser,
  RegisterRequest,
} from '@prizren/shared-types';
import {
  apiFetch,
  ensureAccessToken,
  isAccessTokenExpiringSoon,
  refreshAccessToken,
} from '@/lib/api';
import { getAccessToken, setAccessToken } from '@/lib/auth-token';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
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

  const refreshSession = useCallback(async () => {
    // Always go through the shared single-flight refresh (avoids cookie rotation races)
    const accessToken = await refreshAccessToken();
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
  }, [loadMe, clearProactiveRefresh]);

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
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: payload,
        skipRefresh: true,
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleProactiveRefresh();
    },
    [scheduleProactiveRefresh],
  );

  const register = useCallback(
    async (payload: RegisterRequest) => {
      const data = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: payload,
        skipRefresh: true,
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
      scheduleProactiveRefresh();
    },
    [scheduleProactiveRefresh],
  );

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
      setUser(null);
    }
  }, [clearProactiveRefresh]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshSession,
      ensureSession,
    }),
    [user, loading, login, register, logout, refreshSession, ensureSession],
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
