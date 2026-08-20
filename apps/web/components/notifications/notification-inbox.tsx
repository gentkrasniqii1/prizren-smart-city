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
import type { PaginatedNotifications } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { apiFetch } from '@/lib/api';

type InboxValue = {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const InboxContext = createContext<InboxValue | null>(null);

export function NotificationInboxProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await apiFetch<PaginatedNotifications>('/notifications?limit=1', {
        auth: true,
      });
      setUnreadCount(res.meta.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    void refreshUnread();
  }, [loading, refreshUnread]);

  useRealtimeRefresh(
    () => {
      void refreshUnread();
    },
    Boolean(user) && !loading,
  );

  const value = useMemo(
    () => ({ unreadCount, refreshUnread, setUnreadCount }),
    [unreadCount, refreshUnread],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useNotificationInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error('useNotificationInbox must be used within NotificationInboxProvider');
  }
  return ctx;
}
