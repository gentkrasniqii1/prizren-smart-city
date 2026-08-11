'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AnalyticsByCategoryItem,
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
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { Button, EmptyState, ErrorBanner, Skeleton, Spinner, StatCard } from '@/components/ui';
import { Input, Label, Select } from '@/components/ui/field';
import { getStatusLabel } from '@/lib/labels';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import type { AppLocale } from '@/i18n/request';

const CategoryBarChart = dynamic(
  () => import('@/components/category-bar-chart').then((m) => m.CategoryBarChart),
  {
    ssr: false,
    loading: function ChartSkeleton() {
      return <Skeleton className="h-64 w-full" />;
    },
  },
);

const STATUSES: ReportStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
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
  const { user, loading: authLoading } = useAuth();
  const locale = useLocale() as AppLocale;
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [metaTotal, setMetaTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [staff, setStaff] = useState<PublicUser[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sla, setSla] = useState<AnalyticsSla | null>(null);
  const [byCategory, setByCategory] = useState<AnalyticsByCategoryItem[]>([]);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum, cats, slaRes] = await Promise.all([
        apiFetch<PaginatedReports>(`/reports?${reportQuery}`, { auth: true }),
        apiFetch<AnalyticsSummary>(`/analytics/summary${analyticsQuery}`, { auth: true }),
        apiFetch<AnalyticsByCategoryItem[]>(`/analytics/by-category${analyticsQuery}`, {
          auth: true,
        }),
        apiFetch<AnalyticsSla>(`/analytics/sla${analyticsQuery}`, { auth: true }),
      ]);
      setReports(list.data);
      setMetaTotal(list.meta.total);
      setSummary(sum);
      setByCategory(cats);
      setSla(slaRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [reportQuery, analyticsQuery, t]);

  async function refreshAnalytics() {
    const [sum, cats, slaRes] = await Promise.all([
      apiFetch<AnalyticsSummary>(`/analytics/summary${analyticsQuery}`, { auth: true }),
      apiFetch<AnalyticsByCategoryItem[]>(`/analytics/by-category${analyticsQuery}`, {
        auth: true,
      }),
      apiFetch<AnalyticsSla>(`/analytics/sla${analyticsQuery}`, { auth: true }),
    ]);
    setSummary(sum);
    setByCategory(cats);
    setSla(slaRes);
  }

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void loadDashboard();
  }, [authLoading, user?.role, loadDashboard]);

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
    setMessage(null);
    try {
      const body: UpdateReportStatusRequest = { status: next };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/status`, {
        method: 'PATCH',
        auth: true,
        body,
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setMessage(
        t('statusChanged', {
          id: updated.id.slice(0, 8),
          status: getStatusLabel(updated.status, locale),
        }),
      );
      await refreshAnalytics();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('statusFailed'));
    } finally {
      setRowBusy(null);
    }
  }

  async function assignReport(
    report: ReportDto,
    patch: { departmentId?: string; assignedStaffId?: string },
  ) {
    setRowBusy(report.id);
    setMessage(null);
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
      setMessage(
        updated.dueAt
          ? t('assignSavedDue', {
              id: updated.id.slice(0, 8),
              due: new Date(updated.dueAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL'),
            })
          : t('assignSaved', { id: updated.id.slice(0, 8) }),
      );
      await refreshAnalytics();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('assignFailed'));
    } finally {
      setRowBusy(null);
    }
  }

  if (authLoading) {
    return (
      <main className="py-16">
        <PageContainer width="wide">
          <Spinner label={t('loading')} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </PageContainer>
      </main>
    );
  }

  if (!user || !isStaff(user.role)) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <h1 className="font-display text-2xl tracking-tight text-stone-950">{t('title')}</h1>
          <p className="mt-3 text-stone-600">{t('forbidden')}</p>
          <Link href="/login" className="mt-6 inline-block font-medium text-mosque-800 underline">
            {t('loginLink')}
          </Link>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs items={[{ href: '/', label: t('crumbHome') }, { label: t('title') }]} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1 tracking-tight text-stone-950 sm:text-3xl">
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-stone-600">{t('subtitle')}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadDashboard()}>
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
          <h2 className="font-display text-xl tracking-tight text-stone-950">
            {t('chartHeading')}
          </h2>
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
            <CategoryBarChart data={byCategory} emptyLabel={t('chartEmpty')} />
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <div>
            <h2 className="font-display text-xl tracking-tight text-stone-950">
              {t('tableHeading')}
            </h2>
            <p className="mt-1 text-sm text-stone-600">{t('tableSubtitle')}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 sm:flex-row sm:flex-wrap">
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
          {message ? (
            <p className="text-sm text-river-900" role="status">
              {message}
            </p>
          ) : null}
          {loading ? <Spinner label={t('filtering')} /> : null}
          <p className="text-xs text-stone-500">{t('tableCount', { total: metaTotal })}</p>
          <p className="text-xs text-stone-500 md:hidden">{t('tableScrollHint')}</p>

          <div className="-mx-4 overflow-x-auto border-y border-stone-200 bg-white sm:mx-0 sm:rounded-xl sm:border">
            <table className="min-w-[720px] w-full text-left text-sm md:min-w-full">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{t('colId')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colCategory')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colStatus')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colDepartment')}</th>
                  {canAssign ? <th className="px-3 py-2.5 font-medium">{t('colStaff')}</th> : null}
                  <th className="px-3 py-2.5 font-medium">{t('colSla')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colDate')}</th>
                  <th className="px-3 py-2.5 font-medium">{t('colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {!loading && reports.length === 0 ? (
                  <tr>
                    <td colSpan={canAssign ? 8 : 7} className="px-3 py-6">
                      <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => {
                    const busy = rowBusy === report.id;
                    const bucket = slaBucket(report.dueAt);
                    return (
                      <tr key={report.id} className="border-b border-stone-100 align-top">
                        <td className="px-3 py-2 font-mono text-xs text-stone-600">
                          {report.id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2">{report.categoryName ?? '—'}</td>
                        <td className="px-3 py-2">
                          <select
                            value={report.status}
                            disabled={busy}
                            onChange={(e) =>
                              void changeStatus(report, e.target.value as ReportStatus)
                            }
                            className="max-w-[9.5rem] rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
                            aria-label={t('colStatus')}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {getStatusLabel(s, locale)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {canAssign ? (
                            <select
                              value={report.departmentId ?? ''}
                              disabled={busy}
                              onChange={(e) =>
                                void assignReport(report, { departmentId: e.target.value })
                              }
                              className="max-w-[11rem] rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
                              aria-label={t('colDepartment')}
                            >
                              <option value="">{t('noDepartment')}</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            (report.departmentName ?? '—')
                          )}
                        </td>
                        {canAssign ? (
                          <td className="px-3 py-2">
                            <select
                              value={report.assignedStaffId ?? ''}
                              disabled={busy}
                              onChange={(e) =>
                                void assignReport(report, { assignedStaffId: e.target.value })
                              }
                              className="max-w-[11rem] rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
                              aria-label={t('colStaff')}
                            >
                              <option value="">{t('noStaff')}</option>
                              {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${slaClass(bucket)}`}
                          >
                            {slaLabel(bucket, locale)}
                          </span>
                          {report.dueAt ? (
                            <div className="mt-1 text-[10px] text-stone-500">
                              {new Date(report.dueAt).toLocaleString(
                                locale === 'en' ? 'en-GB' : 'sq-AL',
                              )}
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-600">
                          {new Date(report.createdAt).toLocaleDateString(
                            locale === 'en' ? 'en-GB' : 'sq-AL',
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/reports/${report.id}`}
                            className="text-xs font-medium text-mosque-800 underline"
                          >
                            {t('open')}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
