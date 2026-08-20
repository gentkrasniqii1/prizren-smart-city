'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NotificationDto, PaginatedNotifications } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useNotificationInbox } from '@/components/notifications/notification-inbox';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { PageContainer } from '@/components/layout/page-container';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button, EmptyState, ErrorBanner, FilterTabs } from '@/components/ui';
import { NotificationsPageSkeleton, NotificationListSkeleton } from '@/components/ui/skeletons';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';

type ReadFilter = 'unread' | 'read' | 'all';

export default function NotificationsPage() {
  const t = useTranslations('Notifications');
  const { user, loading } = useAuth();
  const { setUnreadCount } = useNotificationInbox();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [filter, setFilter] = useState<ReadFilter>('unread');
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setLocalUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const load = useCallback(
    async (nextFilter: ReadFilter = filter) => {
      const query = nextFilter === 'all' ? '' : `&read=${nextFilter}`;
      const res = await apiFetch<PaginatedNotifications>(`/notifications?limit=50${query}`, {
        auth: true,
      });
      setItems(res.data);
      setLocalUnread(res.meta.unreadCount);
      setUnreadCount(res.meta.unreadCount);
    },
    [filter, setUnreadCount],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setListLoading(false);
      return;
    }
    void (async () => {
      setListLoading(true);
      try {
        await load(filter);
      } catch (err) {
        setError(errorMessage(err, t('loadError')));
      } finally {
        setListLoading(false);
      }
    })();
  }, [loading, user, load, filter, t, errorMessage]);

  useRealtimeRefresh(
    () => {
      if (user) void load().catch(() => undefined);
    },
    Boolean(user) && !loading,
  );

  async function markOne(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('actionFailed')), 'error');
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
      toast.push(errorMessage(err, t('actionFailed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    if (loading) {
      return (
        <main>
          <NotificationsPageSkeleton label={t('loading')} />
        </main>
      );
    }
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <h1 className="ds-page-title">{t('title')}</h1>
          <p className="mt-cluster text-muted-foreground">{t('loginRequired')}</p>
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

  const filters: ReadFilter[] = ['unread', 'read', 'all'];
  const emptyTitle =
    filter === 'unread'
      ? t('emptyUnreadTitle')
      : filter === 'read'
        ? t('emptyReadTitle')
        : t('emptyTitle');
  const emptyBody =
    filter === 'unread'
      ? t('emptyUnreadBody')
      : filter === 'read'
        ? t('emptyReadBody')
        : t('emptyBody');

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h1 className="ds-page-title">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('unread', { count: unreadCount })}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            status={busy ? 'loading' : 'idle'}
            disabled={busy || unreadCount === 0}
            onClick={() => void markAll()}
            className="w-full sm:w-auto"
          >
            {t('markAll')}
          </Button>
        </div>

        <FilterTabs
          className="mt-6"
          value={filter}
          onChange={setFilter}
          label={t('filterLabel')}
          options={filters.map((item) => ({
            id: item,
            label:
              item === 'unread'
                ? `${t('filterUnread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                : item === 'read'
                  ? t('filterRead')
                  : t('filterAll'),
          }))}
        >
          {error ? (
            <div className="mb-4">
              <ErrorBanner message={error} onRetry={() => void load()} />
            </div>
          ) : null}

          {listLoading ? (
            <NotificationListSkeleton count={6} />
          ) : items.length === 0 ? (
            <EmptyState className="mt-2" title={emptyTitle} description={emptyBody} />
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-card">
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
        </FilterTabs>
      </PageContainer>
    </main>
  );
}
