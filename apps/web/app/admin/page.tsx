'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AnalyticsByCategoryItem,
  AnalyticsByDepartmentItem,
  AnalyticsOverTimeItem,
  AnalyticsSla,
  AnalyticsSummary,
  AssignReportRequest,
  CategoryDto,
  DepartmentDto,
  PaginatedReports,
  PublicUser,
  ReportDto,
  ReportStatus,
  UpdateReportStatusRequest,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { usePolling } from '@/lib/use-polling';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import {
  Button,
  EmptyState,
  ErrorBanner,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import {
  ChartSkeleton,
  DashboardSkeleton,
  MapSkeleton,
  TableRowSkeleton,
} from '@/components/ui/skeletons';
import { Input, Label, Select } from '@/components/ui/field';
import { getStatusLabel } from '@/lib/labels';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import { useErrorMessage } from '@/lib/use-error-message';
import type { AppLocale } from '@/i18n/request';

const CategoryBarChart = dynamic(
  () => import('@/components/category-bar-chart').then((m) => m.CategoryBarChart),
  {
    ssr: false,
    loading: function CategoryChartFallback() {
      return <ChartSkeleton />;
    },
  },
);

const ReportsOverTimeChart = dynamic(
  () => import('@/components/admin/reports-over-time-chart').then((m) => m.ReportsOverTimeChart),
  {
    ssr: false,
    loading: function OverTimeChartFallback() {
      return <ChartSkeleton />;
    },
  },
);

const DepartmentBarChart = dynamic(
  () => import('@/components/admin/department-bar-chart').then((m) => m.DepartmentBarChart),
  {
    ssr: false,
    loading: function DepartmentChartFallback() {
      return <ChartSkeleton />;
    },
  },
);

const ReportsMap = dynamic(() => import('@/components/reports-map').then((m) => m.ReportsMap), {
  ssr: false,
  loading: function AdminMapFallback() {
    return <MapSkeleton className="h-72 w-full" />;
  },
});

const STATUSES: ReportStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
  'RESOLVED',
  'REJECTED',
  'DUPLICATE',
];

const STAFF_ROLES = new Set(['DEPARTMENT_STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']);
const ASSIGN_ROLES = new Set(['DEPARTMENT_ADMIN', 'SUPER_ADMIN']);

function isStaff(role?: string) {
  return Boolean(role && STAFF_ROLES.has(role));
}

function formatHours(
  hours: number | null,
  t: (key: string, values?: Record<string, number>) => string,
) {
  if (hours == null) return '—';
  if (hours < 24) return t('hours', { hours });
  return t('days', { days: Number((hours / 24).toFixed(1)) });
}

export default function AdminPage() {
  const t = useTranslations('Admin');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [metaTotal, setMetaTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [staff, setStaff] = useState<PublicUser[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sla, setSla] = useState<AnalyticsSla | null>(null);
  const [byCategory, setByCategory] = useState<AnalyticsByCategoryItem[]>([]);
  const [byDepartment, setByDepartment] = useState<AnalyticsByDepartmentItem[]>([]);
  const [overTime, setOverTime] = useState<AnalyticsOverTimeItem[]>([]);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const canAssign = ASSIGN_ROLES.has(user?.role ?? '');

  const reportQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    if (departmentId) params.set('departmentId', departmentId);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    return params.toString();
  }, [status, categoryId, departmentId, from, to]);

  const analyticsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (departmentId) params.set('departmentId', departmentId);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [departmentId, from, to]);

  const loadDashboard = useCallback(
    async (opts?: { background?: boolean }) => {
      // Background polling refreshes shouldn't flash the spinner over the
      // table/filters the staff member is currently looking at.
      if (!opts?.background) setLoading(true);
      setError(null);
      try {
        const [list, sum, cats, depts, time, slaRes] = await Promise.all([
          apiFetch<PaginatedReports>(`/reports?${reportQuery}`, { auth: true }),
          apiFetch<AnalyticsSummary>(`/analytics/summary${analyticsQuery}`, { auth: true }),
          apiFetch<AnalyticsByCategoryItem[]>(`/analytics/by-category${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsByDepartmentItem[]>(`/analytics/by-department${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsOverTimeItem[]>(`/analytics/over-time${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsSla>(`/analytics/sla${analyticsQuery}`, { auth: true }),
        ]);
        setReports(list.data);
        setMetaTotal(list.meta.total);
        setSummary(sum);
        setByCategory(cats);
        setByDepartment(depts);
        setOverTime(time);
        setSla(slaRes);
      } catch (err) {
        if (!opts?.background) {
          setError(errorMessage(err, t('loadError')));
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [reportQuery, analyticsQuery, t],
  );

  async function refreshAnalytics() {
    const [sum, cats, depts, time, slaRes] = await Promise.all([
      apiFetch<AnalyticsSummary>(`/analytics/summary${analyticsQuery}`, { auth: true }),
      apiFetch<AnalyticsByCategoryItem[]>(`/analytics/by-category${analyticsQuery}`, {
        auth: true,
      }),
      apiFetch<AnalyticsByDepartmentItem[]>(`/analytics/by-department${analyticsQuery}`, {
        auth: true,
      }),
      apiFetch<AnalyticsOverTimeItem[]>(`/analytics/over-time${analyticsQuery}`, {
        auth: true,
      }),
      apiFetch<AnalyticsSla>(`/analytics/sla${analyticsQuery}`, { auth: true }),
    ]);
    setSummary(sum);
    setByCategory(cats);
    setByDepartment(depts);
    setOverTime(time);
    setSla(slaRes);
  }

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void loadDashboard();
  }, [authLoading, user?.role, loadDashboard]);

  // New reports and status changes should show up here without a manual
  // refresh. Skip the tick while a row mutation is in-flight so a poll can't
  // clobber the optimistic update the staff member is currently reviewing.
  usePolling(
    () => {
      if (!rowBusy) void loadDashboard({ background: true });
    },
    25_000,
    !authLoading && isStaff(user?.role),
  );

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void (async () => {
      try {
        const [cats, depts] = await Promise.all([
          apiFetch<CategoryDto[]>('/categories'),
          apiFetch<DepartmentDto[]>('/departments'),
        ]);
        setCategories(cats);
        setDepartments(depts);
        if (canAssign) {
          const staffList = await apiFetch<PublicUser[]>('/users/staff', { auth: true });
          setStaff(staffList);
        }
      } catch {
        // filters still work without lookup lists
      }
    })();
  }, [authLoading, user?.role, canAssign]);

  async function changeStatus(report: ReportDto, next: ReportStatus) {
    if (next === report.status) return;
    setRowBusy(report.id);
    try {
      const body: UpdateReportStatusRequest = { status: next };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/status`, {
        method: 'PATCH',
        auth: true,
        body,
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.push(
        t('statusChanged', {
          id: updated.id.slice(0, 8),
          status: getStatusLabel(updated.status, locale),
        }),
        'success',
      );
      await refreshAnalytics();
    } catch (err) {
      toast.push(errorMessage(err, t('statusFailed')), 'error');
    } finally {
      setRowBusy(null);
    }
  }

  async function assignReport(
    report: ReportDto,
    patch: { departmentId?: string; assignedStaffId?: string },
  ) {
    setRowBusy(report.id);
    try {
      const body: AssignReportRequest = {};
      if (patch.departmentId !== undefined) {
        body.departmentId = patch.departmentId || null;
      }
      if (patch.assignedStaffId !== undefined) {
        body.assignedStaffId = patch.assignedStaffId || null;
      }
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/assign`, {
        method: 'PATCH',
        auth: true,
        body,
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.push(
        updated.dueAt
          ? t('assignSavedDue', {
              id: updated.id.slice(0, 8),
              due: new Date(updated.dueAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL'),
            })
          : t('assignSaved', { id: updated.id.slice(0, 8) }),
        'success',
      );
      await refreshAnalytics();
    } catch (err) {
      toast.push(errorMessage(err, t('assignFailed')), 'error');
    } finally {
      setRowBusy(null);
    }
  }

  if (authLoading) {
    return (
      <main>
        <DashboardSkeleton label={t('loading')} />
      </main>
    );
  }

  if (!user || !isStaff(user.role)) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <h1 className="ds-page-title">{t('title')}</h1>
          <p className="mt-cluster text-muted-foreground">{t('forbidden')}</p>
          <Link href="/login" className="mt-6 inline-block font-medium text-mosque-800 underline">
            {t('loginLink')}
          </Link>
        </PageContainer>
      </main>
    );
  }

  if (loading && !summary) {
    return (
      <main>
        <DashboardSkeleton label={t('loading')} />
      </main>
    );
  }

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs items={[{ href: '/', label: t('crumbHome') }, { label: t('title') }]} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="ds-page-title">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => void loadDashboard()}
          >
            {t('refresh')}
          </Button>
        </div>

        <section aria-labelledby="admin-kpi-heading" className="mt-8">
          <h2 id="admin-kpi-heading" className="text-label text-stone-700">
            {t('kpiHeading')}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('statTotal')} value={summary?.total ?? '—'} />
            <StatCard label={t('statPending')} value={summary?.pending ?? '—'} />
            <StatCard label={t('statResolved')} value={summary?.resolved ?? '—'} />
            <StatCard
              label={t('statAvg')}
              value={formatHours(summary?.avgResolutionHours ?? null, t)}
            />
          </div>
        </section>

        <section aria-labelledby="admin-sla-heading" className="mt-6">
          <h2 id="admin-sla-heading" className="text-label text-stone-700">
            {t('slaHeading')}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <StatCard label={t('slaOverdue')} value={sla?.overdue ?? '—'} />
            <StatCard label={t('slaDueSoon')} value={sla?.dueSoon ?? '—'} />
            <StatCard label={t('slaOnTime')} value={sla?.onTime ?? '—'} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="ds-section-title">{t('chartHeading')}</h2>
          <div className="mt-cluster grid gap-gutter lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-gutter">
              <CategoryBarChart data={byCategory} emptyLabel={t('chartEmpty')} />
            </div>
            <div className="rounded-xl border border-border bg-card p-gutter">
              <h3 className="text-sm font-medium text-muted-foreground">{t('chartDepartment')}</h3>
              <div className="mt-2">
                <DepartmentBarChart data={byDepartment} emptyLabel={t('chartEmpty')} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-gutter lg:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t('chartOverTime')}</h3>
              <div className="mt-2">
                <ReportsOverTimeChart data={overTime} emptyLabel={t('chartEmpty')} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-section">
          <h2 className="ds-section-title">{t('heatmapHeading')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('heatmapHint')}</p>
          <div className="mt-cluster h-72 overflow-hidden rounded-xl border border-border bg-muted">
            {loading && reports.length === 0 ? (
              <MapSkeleton className="h-full" />
            ) : reports.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('heatmapEmpty')}
              </p>
            ) : (
              <ReportsMap
                reports={reports}
                selectedId={null}
                onSelect={(id) => router.push(`/reports/${id}`)}
                className="h-full min-h-0"
              />
            )}
          </div>
        </section>

        <section className="mt-section space-y-gutter">
          <div>
            <h2 className="ds-section-title">{t('tableHeading')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('tableSubtitle')}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-cluster sm:flex-row sm:flex-wrap">
            <div className="min-w-0 flex-1 sm:min-w-[9rem] sm:flex-none">
              <Label htmlFor="admin-status" className="sr-only">
                {t('filterStatus')}
              </Label>
              <Select
                id="admin-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-0 w-full"
              >
                <option value="">{t('filterStatusAll')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {getStatusLabel(s, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[9rem] sm:flex-none">
              <Label htmlFor="admin-category" className="sr-only">
                {t('filterCategory')}
              </Label>
              <Select
                id="admin-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-0 w-full"
              >
                <option value="">{t('filterCategoryAll')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[9rem] sm:flex-none">
              <Label htmlFor="admin-dept" className="sr-only">
                {t('filterDepartment')}
              </Label>
              <Select
                id="admin-dept"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="mt-0 w-full"
              >
                <option value="">{t('filterDepartmentAll')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div className="min-w-0">
                <Label htmlFor="admin-from" className="sr-only">
                  {t('filterFrom')}
                </Label>
                <Input
                  id="admin-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-0 w-full"
                  aria-label={t('filterFrom')}
                />
              </div>
              <div className="min-w-0">
                <Label htmlFor="admin-to" className="sr-only">
                  {t('filterTo')}
                </Label>
                <Input
                  id="admin-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-0 w-full"
                  aria-label={t('filterTo')}
                />
              </div>
            </div>
          </div>

          {error ? <ErrorBanner message={error} onRetry={() => void loadDashboard()} /> : null}
          <p className="text-caption text-muted-foreground">
            {t('tableCount', { total: metaTotal })}
          </p>
          <p className="text-caption text-muted-foreground md:hidden">{t('tableScrollHint')}</p>

          <div className="-mx-gutter overflow-hidden border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
            <Table className="min-w-[720px] md:min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colId')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colDepartment')}</TableHead>
                  {canAssign ? <TableHead>{t('colStaff')}</TableHead> : null}
                  <TableHead>{t('colSla')}</TableHead>
                  <TableHead>{t('colDate')}</TableHead>
                  <TableHead>{t('colDetail')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && reports.length === 0 ? (
                  Array.from({ length: 6 }, (_, i) => (
                    <TableRowSkeleton key={i} cols={canAssign ? 8 : 7} />
                  ))
                ) : !loading && reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canAssign ? 8 : 7} className="py-6">
                      <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => {
                    const busy = rowBusy === report.id;
                    const bucket = slaBucket(report.dueAt);
                    return (
                      <TableRow key={report.id} className="align-top">
                        <TableCell className="font-mono text-caption text-muted-foreground">
                          {report.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{report.categoryName ?? '—'}</TableCell>
                        <TableCell>
                          <Select
                            fieldSize="sm"
                            value={report.status}
                            disabled={busy}
                            onChange={(e) =>
                              void changeStatus(report, e.target.value as ReportStatus)
                            }
                            className="max-w-[9.5rem]"
                            aria-label={t('colStatus')}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {getStatusLabel(s, locale)}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          {canAssign ? (
                            <Select
                              fieldSize="sm"
                              value={report.departmentId ?? ''}
                              disabled={busy}
                              onChange={(e) =>
                                void assignReport(report, { departmentId: e.target.value })
                              }
                              className="max-w-[11rem]"
                              aria-label={t('colDepartment')}
                            >
                              <option value="">{t('noDepartment')}</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            (report.departmentName ?? '—')
                          )}
                        </TableCell>
                        {canAssign ? (
                          <TableCell>
                            <Select
                              fieldSize="sm"
                              value={report.assignedStaffId ?? ''}
                              disabled={busy}
                              onChange={(e) =>
                                void assignReport(report, { assignedStaffId: e.target.value })
                              }
                              className="max-w-[11rem]"
                              aria-label={t('colStaff')}
                            >
                              <option value="">{t('noStaff')}</option>
                              {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </Select>
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-caption font-semibold ${slaClass(bucket)}`}
                          >
                            {slaLabel(bucket, locale)}
                          </span>
                          {report.dueAt ? (
                            <div className="mt-1 text-caption text-muted-foreground">
                              {new Date(report.dueAt).toLocaleString(
                                locale === 'en' ? 'en-GB' : 'sq-AL',
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-caption text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString(
                            locale === 'en' ? 'en-GB' : 'sq-AL',
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/reports/${report.id}`}
                            className="text-caption font-medium text-primary underline"
                          >
                            {t('open')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
