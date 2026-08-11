'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { TransparencyStats } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { PageContainer } from '@/components/layout/page-container';
import { EmptyState, ErrorBanner, Skeleton, StatCard } from '@/components/ui';
import { getStatusLabel } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';
import { cn } from '@/lib/utils';

function DistributionList({
  items,
  emptyLabel,
}: {
  items: { key: string; label: string; count: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-stone-500">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {items.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-stone-700">{row.label}</span>
            <span className="shrink-0 tabular-nums font-semibold text-stone-900">{row.count}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-mosque-600 transition-[width] duration-500"
              style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TransparencyView() {
  const t = useTranslations('Transparency');
  const locale = useLocale() as AppLocale;
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<TransparencyStats>('/transparency');
        setStats(data);
      } catch {
        setError(t('loadError'));
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, []);

  const statusItems =
    stats?.byStatus.map((row) => ({
      key: row.status,
      label: getStatusLabel(row.status, locale),
      count: row.count,
    })) ?? [];

  const categoryItems =
    stats?.byCategory.map((row) => ({
      key: row.categoryId ?? row.category,
      label: row.category,
      count: row.count,
    })) ?? [];

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="default">
        <header className="max-w-2xl">
          <p className="text-caption uppercase tracking-[0.14em] text-mosque-800">{t('eyebrow')}</p>
          <h1 className="mt-2 font-display text-h1 tracking-tight text-stone-950 sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-stone-600">{t('subtitle')}</p>
        </header>

        {error ? (
          <div className="mt-6">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : null}

        {!loading && !error && stats && stats.total === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={t('emptyTitle')}
              description={t('emptyBody')}
              action={
                <Link
                  href="/report"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
                >
                  {t('ctaReport')}
                </Link>
              }
            />
          </div>
        ) : null}

        {stats && stats.total > 0 ? (
          <>
            <section aria-labelledby="transparency-kpis" className="mt-8">
              <h2 id="transparency-kpis" className="sr-only">
                {t('kpiHeading')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label={t('statTotal')} value={stats.total} />
                <StatCard label={t('statResolved')} value={stats.resolved} />
                <StatCard label={t('statOpen')} value={stats.pendingOpen} />
                <StatCard
                  label={t('statRate')}
                  value={stats.resolutionRate == null ? '—' : `${stats.resolutionRate}%`}
                  hint={t('statRateHint')}
                />
              </div>
              <p className="mt-4 text-sm text-stone-600">
                {t('avgResolution')}:{' '}
                <span className="font-medium text-stone-900">
                  {stats.avgResolutionHours == null
                    ? '—'
                    : t('hours', { hours: stats.avgResolutionHours })}
                </span>
              </p>
            </section>

            <section className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <h2 className="font-display text-lg tracking-tight text-stone-950">
                  {t('byStatus')}
                </h2>
                <DistributionList items={statusItems} emptyLabel={t('noData')} />
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-5">
                <h2 className="font-display text-lg tracking-tight text-stone-950">
                  {t('byCategory')}
                </h2>
                <DistributionList items={categoryItems} emptyLabel={t('noData')} />
              </div>
            </section>

            <div className={cn('mt-10 flex flex-wrap gap-3')}>
              <Link
                href="/reports"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
              >
                {t('ctaMap')}
              </Link>
              <Link
                href="/report"
                className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-50"
              >
                {t('ctaReport')}
              </Link>
            </div>

            <p className="mt-6 text-xs text-stone-500">{t('privacyNote')}</p>
          </>
        ) : null}
      </PageContainer>
    </main>
  );
}
