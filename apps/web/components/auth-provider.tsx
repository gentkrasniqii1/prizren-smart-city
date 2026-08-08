'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { getAccessToken, setAccessToken } from '@/lib/auth-token';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        skipRefresh: true,
      });
      setAccessToken(accessToken);
      const me = await apiFetch<PublicUser>('/users/me', { auth: true, skipRefresh: true });
      setUser(me);
      return true;
    } catch {
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const login = useCallback(async (payload: LoginRequest) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      skipRefresh: true,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: RegisterRequest) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      skipRefresh: true,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
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
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshSession }),
    [user, loading, login, register, logout, refreshSession],
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
