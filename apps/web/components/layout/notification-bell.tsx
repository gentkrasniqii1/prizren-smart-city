'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PaginatedNotifications } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useRealtimeRefresh } from '@/components/realtime-provider';

export function NotificationBell() {
  const t = useTranslations('Nav');
  const { user, loading } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = () => {
    if (loading || !user) return;
    void (async () => {
      try {
        const res = await apiFetch<PaginatedNotifications>('/notifications?limit=1', {
          auth: true,
        });
        setUnread(res.meta.unreadCount ?? 0);
      } catch {
        setUnread(0);
      }
    })();
  };

  useEffect(() => {
    if (loading || !user) {
      setUnread(0);
      return;
    }
    refreshUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/session only
  }, [loading, user]);

  useRealtimeRefresh(refreshUnread, Boolean(user) && !loading);

  if (loading || !user) return null;

  return (
    <Button asChild variant="icon" size="sm" className="relative shrink-0">
      <Link
        href="/notifications"
        aria-label={unread > 0 ? `${t('notifications')} (${unread})` : t('notifications')}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
