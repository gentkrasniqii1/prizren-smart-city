'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PaginatedNotifications } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const t = useTranslations('Nav');
  const { user, loading } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<PaginatedNotifications>('/notifications?limit=1', {
          auth: true,
        });
        if (!cancelled) setUnread(res.meta.unreadCount ?? 0);
      } catch {
        if (!cancelled) setUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (loading || !user) return null;

  return (
    <Link
      href="/notifications"
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center rounded-md text-stone-700',
        'hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mosque-700',
      )}
      aria-label={unread > 0 ? `${t('notifications')} (${unread})` : t('notifications')}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 ? (
        <span
          className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
          aria-hidden
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
