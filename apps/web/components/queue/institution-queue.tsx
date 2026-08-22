'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Inbox, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  QUEUE_LANES,
  type PaginatedReports,
  type QueueLane,
  type ReportDto,
  type WorkflowAction,
  type WorkflowActionRequest,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { PageContainer } from '@/components/layout/page-container';
import { RemoteImage } from '@/components/remote-image';
import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  MapSkeleton,
  PriorityBadge,
  StatusBadge,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';
import { getAiCategoryLabel } from '@/lib/labels';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/request';

const ReportsMap = dynamic(() => import('@/components/reports-map').then((m) => m.ReportsMap), {
  ssr: false,
  loading: function QueueMapFallback() {
    return <MapSkeleton className="h-56 w-full rounded-xl lg:h-72" />;
  },
});

function isStaff(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

function mapUrl(report: ReportDto) {
  return `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=17/${report.lat}/${report.lng}`;
}

export function InstitutionQueue() {
  const t = useTranslations('Queue');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [lane, setLane] = useState<QueueLane>('pending');
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [laneCounts, setLaneCounts] = useState<Partial<Record<QueueLane, number>>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isStaff(user?.role)) {
      router.replace(user ? '/account' : '/login');
    }
  }, [authLoading, user, router]);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!opts?.background) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await apiFetch<PaginatedReports>(`/reports/queue?lane=${lane}&limit=50`, {
          auth: true,
        });
        setReports(res.data);
        setTotal(res.meta.total);
        setLaneCounts(res.meta.laneCounts ?? {});
        setSelectedId((current) =>
          current && res.data.some((item) => item.id === current)
            ? current
            : (res.data[0]?.id ?? null),
        );
      } catch (err) {
        if (!opts?.background) {
          setError(errorMessage(err, t('loadError')));
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [lane, errorMessage, t],
  );

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void load();
  }, [authLoading, user?.role, load]);

  useRealtimeRefresh(
    () => {
      if (!busyId) void load({ background: true });
    },
    !authLoading && isStaff(user?.role),
  );

  async function runAction(report: ReportDto, action: WorkflowAction) {
    setBusyId(report.id);
    try {
      const body: WorkflowActionRequest = { action };
      await apiFetch<ReportDto>(`/reports/${report.id}/workflow`, {
        method: 'POST',
        auth: true,
        body,
      });
      toast.push(t(`done.${action}`), 'success');
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('actionFailed')), 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || !isStaff(user?.role)) {
    return (
      <main>
        <TableSkeleton />
      </main>
    );
  }

  const dateLocale = locale === 'en' ? 'en-GB' : 'sq-AL';

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <header className="max-w-3xl">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">
            {t('kicker')}
          </p>
          <h1 className="ds-page-title mt-1">{t('title')}</h1>
          <p className="mt-2 text-body text-muted-foreground">{t('intro')}</p>
        </header>

        <FilterTabs
          className="mt-6"
          value={lane}
          onChange={setLane}
          label={t('lanesLabel')}
          options={QUEUE_LANES.map((item) => ({
            id: item,
            label: t(`lanes.${item}`),
            count: laneCounts[item],
            dividerBefore: item === 'incoming',
          }))}
        >
          <p className="mb-4 text-sm text-muted-foreground">{t(`laneIntro.${lane}`)}</p>

          {error ? (
            <div className="mb-6">
              <ErrorBanner title={t('loadError')} message={error} onRetry={() => void load()} />
            </div>
          ) : null}

          {loading ? (
            <TableSkeleton />
          ) : reports.length === 0 ? (
            <EmptyState
              className="mt-2"
              icon={<Inbox className="h-5 w-5" aria-hidden />}
              title={t('emptyTitle')}
              description={t(`empty.${lane}`)}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {reports.map((report) => {
                  const bucket = slaBucket(report.dueAt);
                  const primary =
                    lane === 'pending'
                      ? undefined
                      : report.allowedActions?.find(
                          (action) =>
                            action === 'accept' || action === 'investigate' || action === 'resolve',
                        );
                  const aiLabel = report.aiClassification
                    ? getAiCategoryLabel(report.aiClassification.category, locale)
                    : null;
                  return (
                    <li
                      key={report.id}
                      className={cn(
                        'flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start',
                        selectedId === report.id && 'bg-muted/60',
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 gap-3 text-left"
                        onClick={() => setSelectedId(report.id)}
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                          {report.photoUrl ? (
                            <RemoteImage
                              src={report.photoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                              {t('noPhoto')}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-caption font-semibold text-muted-foreground">
                              {report.publicId}
                            </span>
                            <StatusBadge status={report.status} />
                            {report.priority ? <PriorityBadge priority={report.priority} /> : null}
                            {bucket ? (
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                                  slaClass(bucket),
                                )}
                              >
                                {slaLabel(bucket, locale)}
                              </span>
                            ) : null}
                            {report.isDuplicate || report.duplicateOfId ? (
                              <span className="inline-flex items-center rounded-md bg-semantic-warning px-2 py-0.5 text-[11px] font-semibold text-semantic-warning-foreground">
                                {t('duplicateHint')}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                            {report.description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              report.categoryName
                                ? t('officialCategory', { name: report.categoryName })
                                : t('noCategory'),
                              report.institutionName ?? report.departmentName,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {lane === 'pending' && aiLabel ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t('aiSuggests', { name: aiLabel })}
                            </p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {report.address
                                ? report.address
                                : `${report.lat.toFixed(3)}, ${report.lng.toFixed(3)}`}
                            </span>
                            {report.dueAt ? (
                              <span>
                                {t('dueAt', {
                                  when: new Date(report.dueAt).toLocaleString(dateLocale, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  }),
                                })}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                        {primary ? (
                          <Button
                            type="button"
                            size="sm"
                            loading={busyId === report.id}
                            onClick={() => void runAction(report, primary)}
                          >
                            {t(`actions.${primary}`)}
                          </Button>
                        ) : null}
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/reports/${report.id}`}>
                            {lane === 'pending' ? t('review') : t('open')}
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={mapUrl(report)} target="_blank" rel="noreferrer">
                            {t('openMap')}
                          </a>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="overflow-hidden rounded-xl border border-border">
                <ReportsMap
                  reports={reports}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  className="h-56 w-full lg:h-[28rem]"
                />
              </div>
            </div>
          )}

          <p className="mt-4 text-caption text-muted-foreground">
            {t('showing', { count: reports.length, total })}
          </p>
        </FilterTabs>
      </PageContainer>
    </main>
  );
}
