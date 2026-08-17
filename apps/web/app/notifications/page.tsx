'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NotificationDto, PaginatedNotifications } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageContainer } from '@/components/layout/page-container';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button, EmptyState, ErrorBanner, Spinner } from '@/components/ui';

export default function NotificationsPage() {
  const t = useTranslations('Notifications');
  const { user, loading } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<PaginatedNotifications>('/notifications?limit=50', {
      auth: true,
    });
    setItems(res.data);
    setUnreadCount(res.meta.unreadCount);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('loadError'));
      }
    })();
  }, [loading, user, load, t]);

  async function markOne(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await apiFetch('/notifications/read-all', { method: 'POST', auth: true });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <Spinner label={t('loading')} />
        </PageContainer>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <h1 className="font-display text-2xl tracking-tight text-stone-950">{t('title')}</h1>
          <p className="mt-3 text-stone-600">{t('loginRequired')}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center font-medium text-mosque-800 underline"
          >
            {t('loginLink')}
          </Link>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-h1 tracking-tight text-stone-950 sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-stone-600">{t('unread', { count: unreadCount })}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || unreadCount === 0}
            onClick={() => void markAll()}
            className="w-full sm:w-auto"
          >
            {t('markAll')}
          </Button>
        </div>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState className="mt-8" title={t('emptyTitle')} description={t('emptyBody')} />
        ) : (
          <ul className="mt-6 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-card">
            {items.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                busy={busy}
                onMarkRead={(id) => void markOne(id)}
              />
            ))}
          </ul>
        )}
      </PageContainer>
    </main>
  );
}
