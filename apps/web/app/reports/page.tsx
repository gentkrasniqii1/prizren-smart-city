'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { PaginatedReports, ReportDto } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { PageContainer } from '@/components/layout/page-container';
import { ReportCard } from '@/components/reports/report-card';
import { ReportDrawer } from '@/components/reports/report-drawer';
import { ReportFilters, type ReportsFilterState } from '@/components/reports/report-filters';
import { Button, EmptyState, ErrorBanner } from '@/components/ui';
import { MapSkeleton, ReportCardListSkeleton } from '@/components/ui/skeletons';
import { useErrorMessage } from '@/lib/use-error-message';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AppLocale } from '@/i18n/request';
import { cn } from '@/lib/utils';

const ReportsMap = dynamic(() => import('@/components/reports-map').then((m) => m.ReportsMap), {
  ssr: false,
  loading: function ReportsMapFallback() {
    return <MapSkeleton className="h-full min-h-[280px] w-full" />;
  },
});

const initialFilters: ReportsFilterState = {
  query: '',
  status: '',
  categoryId: '',
  priority: '',
  from: '',
  to: '',
  nearbyKm: '',
};

export default function ReportsPage() {
  const t = useTranslations('Reports');
  const locale = useLocale() as AppLocale;
  const errorMessage = useErrorMessage();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportsFilterState>(initialFilters);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<'peek' | 'list'>('peek');

  function loadReports() {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        if (filters.status) params.set('status', filters.status);
        if (filters.categoryId) params.set('categoryId', filters.categoryId);
        if (filters.from) params.set('from', new Date(filters.from).toISOString());
        if (filters.to) {
          params.set('to', new Date(`${filters.to}T23:59:59.999`).toISOString());
        }
        const res = await apiFetch<PaginatedReports>(`/reports?${params.toString()}`);
        setReports(res.data);
      } catch (err) {
        setError(errorMessage(err, t('loadError')));
      } finally {
        setLoading(false);
      }
    })();
  }

  useEffect(() => {
    void apiFetch<{ id: string; name: string }[]>('/categories')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when server-side filters change
  }, [filters.status, filters.categoryId, filters.from, filters.to]);

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return reports.filter((r) => {
      if (filters.priority && r.priority !== filters.priority) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        (r.address?.toLowerCase().includes(q) ?? false) ||
        (r.categoryName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [reports, filters.query, filters.priority]);

  const selected = useMemo(
    () => visible.find((r) => r.id === selectedId) ?? null,
    [visible, selectedId],
  );

  useEffect(() => {
    if (selectedId && !visible.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visible, selectedId]);

  async function loadNearby() {
    const km = Number(filters.nearbyKm);
    if (!Number.isFinite(km) || km <= 0) {
      setError(t('nearbyInvalid'));
      return;
    }
    if (!navigator.geolocation) {
      setError(t('geoUnsupported'));
      return;
    }
    setNearbyBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await apiFetch<ReportDto[]>(
            `/reports/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radiusKm=${km}`,
          );
          setReports(data);
          setSelectedId(null);
        } catch (err) {
          setError(errorMessage(err, t('nearbyFailed')));
        } finally {
          setNearbyBusy(false);
        }
      },
      () => {
        setError(t('geoDenied'));
        setNearbyBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function selectReport(id: string) {
    setSelectedId(id);
    setMobileSheet('peek');
  }

  const listPanel = (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">
          {loading ? (
            <span className="inline-block h-4 w-28 animate-pulse rounded bg-muted" aria-hidden />
          ) : (
            t('count', { count: visible.length })
          )}
        </span>
        <button
          type="button"
          className="inline-flex min-h-10 shrink-0 items-center rounded-md px-3 text-xs font-semibold text-mosque-800 ring-1 ring-mosque-200 md:hidden"
          onClick={() => setMobileSheet((s) => (s === 'list' ? 'peek' : 'list'))}
        >
          {mobileSheet === 'list' ? t('showMap') : t('expandList')}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 overflow-hidden" role="status" aria-busy="true">
          <span className="sr-only">{t('loading')}</span>
          <ReportCardListSkeleton count={6} compact />
        </div>
      ) : visible.length === 0 ? (
        <div className="p-3">
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyBody')}
            action={
              <Link href="/report">
                <Button size="sm">{t('reportFirst')}</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {visible.map((r) => (
            <li key={r.id}>
              <ReportCard
                report={r}
                selected={selectedId === r.id}
                onSelect={selectReport}
                compact
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <main className="pb-2">
      <PageContainer className="py-5 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="ds-page-title">{t('title')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
          </div>
          <Link href="/report" className="hidden sm:block sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto">
              {t('reportCta')}
            </Button>
          </Link>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-card p-3 sm:p-4">
          <ReportFilters
            value={filters}
            onChange={setFilters}
            categories={categories}
            locale={locale}
            nearbyBusy={nearbyBusy}
            onNearby={() => void loadNearby()}
          />
        </div>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} onRetry={loadReports} />
          </div>
        ) : null}
      </PageContainer>

      {/* Desktop GIS layout: list | map (+ drawer) */}
      <PageContainer width="wide" className="hidden pb-8 lg:block">
        <div className="grid h-[min(70vh,720px)] overflow-hidden rounded-xl border border-border bg-muted lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <div className="min-h-0 border-r border-border bg-card">{listPanel}</div>
          <div className="relative min-h-0">
            <ReportsMap
              reports={visible}
              selectedId={selectedId}
              onSelect={selectReport}
              className="h-full min-h-0"
            />
            {selected ? (
              <div
                key={selected.id}
                className="motion-slide-in-right absolute inset-y-3 right-3 z-10 w-[min(100%,22rem)] overflow-hidden rounded-lg border border-border"
              >
                <ReportDrawer report={selected} onClose={() => setSelectedId(null)} />
              </div>
            ) : null}
          </div>
        </div>
      </PageContainer>

      {/* Mobile / tablet: map + bottom sheet list; detail via Sheet */}
      <div className="pb-bottom-nav lg:hidden">
        <div
          className={cn(
            'relative overflow-hidden border-y border-border bg-muted transition-[height] duration-slow ease-product',
            mobileSheet === 'list' ? 'h-[28svh]' : 'h-[42svh]',
          )}
        >
          <ReportsMap
            reports={visible}
            selectedId={selectedId}
            onSelect={selectReport}
            className="h-full min-h-0 rounded-none border-0"
          />
        </div>

        <div
          className={cn(
            'relative z-10 -mt-3 overflow-hidden rounded-t-2xl border border-border bg-card shadow-lift',
            mobileSheet === 'list' ? 'min-h-[50svh]' : 'max-h-[40svh]',
          )}
        >
          <div className="flex justify-center py-2" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <div className={cn('min-h-0', mobileSheet === 'list' ? 'h-[50svh]' : 'max-h-[36svh]')}>
            {listPanel}
          </div>
        </div>

        <Sheet
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <SheetContent
            side="bottom"
            className="h-[min(78svh,36rem)] gap-0 border-border p-0 sm:mx-auto sm:max-w-lg sm:rounded-t-xl [&>button]:right-3 [&>button]:top-3"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t('drawerTitle')}</SheetTitle>
              <SheetDescription>{t('drawerLabel')}</SheetDescription>
            </SheetHeader>
            {selected ? (
              <ReportDrawer
                report={selected}
                onClose={() => setSelectedId(null)}
                modal
                hideClose
                className="rounded-none border-0 shadow-none"
              />
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}
