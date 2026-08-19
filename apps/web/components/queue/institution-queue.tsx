'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  PaginatedReports,
  QueueLane,
  ReportDto,
  WorkflowAction,
  WorkflowActionRequest,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageContainer } from '@/components/layout/page-container';
import { Button, EmptyState, ErrorBanner, PriorityBadge, StatusBadge } from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/request';

const LANES: QueueLane[] = ['incoming', 'active', 'waiting', 'done'];

function isStaff(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

export function InstitutionQueue() {
  const t = useTranslations('Queue');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [lane, setLane] = useState<QueueLane>('incoming');
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isStaff(user?.role)) {
      router.replace(user ? '/account' : '/login');
    }
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<PaginatedReports>(`/reports/queue?lane=${lane}&limit=50`, {
        auth: true,
      });
      setReports(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(errorMessage(err, t('loadError')));
    } finally {
      setLoading(false);
    }
  }, [lane, errorMessage, t]);

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void load();
  }, [authLoading, user?.role, load]);

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

        <div
          className="mt-6 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
          role="tablist"
          aria-label={t('lanesLabel')}
        >
          {LANES.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={lane === item ? 'secondary' : 'ghost'}
              aria-selected={lane === item}
              onClick={() => setLane(item)}
            >
              {t(`lanes.${item}`)}
            </Button>
          ))}
        </div>

        {error ? (
          <div className="mt-6">
            <ErrorBanner title={t('loadError')} message={error} onRetry={() => void load()} />
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6">
            <TableSkeleton />
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Inbox className="h-5 w-5" aria-hidden />}
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {reports.map((report) => {
              const bucket = slaBucket(report.dueAt);
              const primary = report.allowedActions?.find(
                (action) => action === 'accept' || action === 'investigate' || action === 'resolve',
              );
              return (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                >
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
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                      {report.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[report.categoryName, report.institutionName ?? report.departmentName]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
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
                      <Link href={`/reports/${report.id}`}>{t('open')}</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-caption text-muted-foreground">
          {t('showing', { count: reports.length, total })}
        </p>
      </PageContainer>
    </main>
  );
}
