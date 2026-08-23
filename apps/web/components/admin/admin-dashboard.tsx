'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AnalyticsByCategoryItem,
  AnalyticsByInstitutionItem,
  AnalyticsByStatusItem,
  AnalyticsOverTimeItem,
  AnalyticsSummary,
  AssignReportRequest,
  CategoryDto,
  DepartmentDto,
  InstitutionDto,
  ModerateReportRequest,
  PaginatedReports,
  PublicUser,
  ReportDto,
  UpdateReportPriorityRequest,
  UpdateReportStatusRequest,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { usePolling, LIVE_POLL_MS } from '@/lib/use-polling';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { useToast } from '@/components/toast-provider';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { AdminReportActions } from '@/components/admin/admin-report-actions';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PriorityBadge,
  StatCard,
  StatusBadge,
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
import { colors } from '@/lib/design-tokens';
import { getPriorityLabel, getStatusLabel, REPORT_PRIORITIES, REPORT_STATUSES } from '@/lib/labels';
import { useErrorMessage } from '@/lib/use-error-message';
import type { AppLocale } from '@/i18n/request';

const NamedBarChart = dynamic(
  () => import('@/components/admin/named-bar-chart').then((m) => m.NamedBarChart),
  {
    ssr: false,
    loading: function ChartFallback() {
      return <ChartSkeleton />;
    },
  },
);

const ReportsOverTimeChart = dynamic(
  () => import('@/components/admin/reports-over-time-chart').then((m) => m.ReportsOverTimeChart),
  {
    ssr: false,
    loading: function OverTimeFallback() {
      return <ChartSkeleton />;
    },
  },
);

const StatusDistributionChart = dynamic(
  () =>
    import('@/components/admin/status-distribution-chart').then((m) => m.StatusDistributionChart),
  {
    ssr: false,
    loading: function StatusFallback() {
      return <ChartSkeleton />;
    },
  },
);

const ReportsMap = dynamic(() => import('@/components/reports-map').then((m) => m.ReportsMap), {
  ssr: false,
  loading: function MapFallback() {
    return <MapSkeleton className="h-80 w-full" />;
  },
});

const STAFF_ROLES = new Set(['DEPARTMENT_STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']);
const ASSIGN_ROLES = new Set(['DEPARTMENT_ADMIN', 'SUPER_ADMIN']);

function isStaff(role?: string) {
  return Boolean(role && STAFF_ROLES.has(role));
}

function formatLocation(report: ReportDto) {
  if (report.address?.trim()) return report.address;
  return `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`;
}

export function AdminDashboard() {
  const t = useTranslations('Admin');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const dateLocale = locale === 'en' ? 'en-GB' : 'sq-AL';

  const [reports, setReports] = useState<ReportDto[]>([]);
  const [mapReports, setMapReports] = useState<ReportDto[]>([]);
  const [metaTotal, setMetaTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [staff, setStaff] = useState<PublicUser[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byCategory, setByCategory] = useState<AnalyticsByCategoryItem[]>([]);
  const [byStatus, setByStatus] = useState<AnalyticsByStatusItem[]>([]);
  const [byInstitution, setByInstitution] = useState<AnalyticsByInstitutionItem[]>([]);
  const [overTime, setOverTime] = useState<AnalyticsOverTimeItem[]>([]);
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canAssign = ASSIGN_ROLES.has(user?.role ?? '');

  const reportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    if (priority) params.set('priority', priority);
    if (institutionId) params.set('institutionId', institutionId);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    return params;
  }, [status, categoryId, priority, institutionId, from, to]);

  const analyticsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (institutionId) params.set('institutionId', institutionId);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [institutionId, from, to]);

  const loadDashboard = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!opts?.background) setLoading(true);
      setError(null);
      try {
        const tableParams = new URLSearchParams(reportQuery);
        tableParams.set('limit', '50');
        const mapParams = new URLSearchParams(reportQuery);
        mapParams.set('limit', '100');

        const [list, mapList, sum, cats, statuses, inst, time] = await Promise.all([
          apiFetch<PaginatedReports>(`/reports?${tableParams}`, { auth: true }),
          apiFetch<PaginatedReports>(`/reports?${mapParams}`, { auth: true }),
          apiFetch<AnalyticsSummary>(`/analytics/summary${analyticsQuery}`, { auth: true }),
          apiFetch<AnalyticsByCategoryItem[]>(`/analytics/by-category${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsByStatusItem[]>(`/analytics/by-status${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsByInstitutionItem[]>(`/analytics/by-institution${analyticsQuery}`, {
            auth: true,
          }),
          apiFetch<AnalyticsOverTimeItem[]>(`/analytics/over-time${analyticsQuery}`, {
            auth: true,
          }),
        ]);
        setReports(list.data);
        setMetaTotal(list.meta.total);
        setMapReports(mapList.data);
        setSummary(sum);
        setByCategory(cats);
        setByStatus(statuses);
        setByInstitution(inst);
        setOverTime(time);
      } catch (err) {
        if (!opts?.background) {
          setError(errorMessage(err, t('loadError')));
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [reportQuery, analyticsQuery, t, errorMessage],
  );

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void loadDashboard();
  }, [authLoading, user?.role, loadDashboard]);

  usePolling(
    () => {
      if (!rowBusy) void loadDashboard({ background: true });
    },
    LIVE_POLL_MS,
    !authLoading && isStaff(user?.role),
  );

  useRealtimeRefresh(
    () => {
      if (!rowBusy) void loadDashboard({ background: true });
    },
    !authLoading && isStaff(user?.role),
  );

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void (async () => {
      try {
        const [cats, depts, inst] = await Promise.all([
          apiFetch<CategoryDto[]>('/categories'),
          apiFetch<DepartmentDto[]>('/departments'),
          apiFetch<InstitutionDto[]>('/institutions'),
        ]);
        setCategories(cats);
        setDepartments(depts);
        setInstitutions(inst);
        if (canAssign) {
          const staffList = await apiFetch<PublicUser[]>('/users/staff', { auth: true });
          setStaff(staffList);
        }
      } catch {
        // filters still work without lookup lists
      }
    })();
  }, [authLoading, user?.role, canAssign]);

  function patchRow(updated: ReportDto) {
    setReports((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setMapReports((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  async function runMutation(id: string, work: () => Promise<ReportDto>, success: string) {
    setRowBusy(id);
    try {
      const updated = await work();
      patchRow(updated);
      toast.push(success, 'success');
      void loadDashboard({ background: true });
      return updated;
    } catch (err) {
      toast.push(errorMessage(err, t('actionFailed')), 'error');
      throw err;
    } finally {
      setRowBusy(null);
    }
  }

  async function handleAssign(report: ReportDto, patch: AssignReportRequest) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/assign`, {
          method: 'PATCH',
          auth: true,
          body: patch,
        }),
      t('assignSaved', { id: report.publicId }),
    );
  }

  async function handleStatus(report: ReportDto, body: UpdateReportStatusRequest) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/status`, {
          method: 'PATCH',
          auth: true,
          body,
        }),
      t('statusChanged', {
        id: report.publicId,
        status: getStatusLabel(body.status, locale),
      }),
    );
  }

  async function handlePriority(report: ReportDto, body: UpdateReportPriorityRequest) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/priority`, {
          method: 'PATCH',
          auth: true,
          body,
        }),
      t('prioritySaved', {
        id: report.publicId,
        priority: getPriorityLabel(body.priority, locale),
      }),
    );
  }

  async function handleModerate(report: ReportDto, body: ModerateReportRequest) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/moderate`, {
          method: 'POST',
          auth: true,
          body,
        }),
      body.action === 'approve'
        ? t('moderateApproved', { id: report.publicId })
        : t('moderateRejected', { id: report.publicId }),
    );
  }

  async function handleNote(report: ReportDto, note: string) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/notes`, {
          method: 'POST',
          auth: true,
          body: { note },
        }),
      t('noteSaved', { id: report.publicId }),
    );
  }

  async function handleEscalate(report: ReportDto, note: string) {
    await runMutation(
      report.id,
      () =>
        apiFetch<ReportDto>(`/reports/${report.id}/escalate`, {
          method: 'PATCH',
          auth: true,
          body: note ? { note } : {},
        }),
      t('escalated', { id: report.publicId }),
    );
  }

  async function handleResolve(report: ReportDto) {
    await handleStatus(report, { status: 'RESOLVED' });
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
      <main className="pb-bottom-nav pt-8">
        <PageContainer width="narrow">
          <p className="ds-kicker">{t('kicker')}</p>
          <h1 className="ds-page-title mt-3">{t('title')}</h1>
          <p className="mt-cluster text-muted-foreground">{t('forbidden')}</p>
          <Button asChild className="mt-6">
            <Link href="/login">{t('loginLink')}</Link>
          </Button>
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

  const categoryChart = byCategory.map((row) => ({ name: row.category, count: row.count }));
  const institutionChart = byInstitution.map((row) => ({
    name: row.institution,
    count: row.count,
  }));

  return (
    <main className="bg-muted/30 pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs items={[{ href: '/', label: t('crumbHome') }, { label: t('title') }]} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ds-kicker">{t('kicker')}</p>
            <h1 className="ds-page-title mt-2">{t('title')}</h1>
            <p className="mt-1 text-small text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-cluster">
            <p className="text-caption text-muted-foreground">{t('liveHint')}</p>
            {user.role === 'SUPER_ADMIN' ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/data">{t('dataLink')}</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/routing">{t('routingLink')}</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/mail">{t('mailLink')}</Link>
            </Button>
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
        </div>

        <section aria-labelledby="admin-kpi-heading" className="mt-8">
          <h2 id="admin-kpi-heading" className="sr-only">
            {t('kpiHeading')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label={t('statTotal')} value={summary?.total ?? '—'} />
            <StatCard label={t('statNewToday')} value={summary?.newToday ?? '—'} />
            <StatCard label={t('statInProgress')} value={summary?.inProgress ?? '—'} />
            <StatCard label={t('statResolved')} value={summary?.resolved ?? '—'} />
            <StatCard
              label={t('statCritical')}
              value={summary?.critical ?? '—'}
              className="border-semantic-danger bg-semantic-danger"
            />
          </div>
        </section>

        <section className="mt-8 grid gap-gutter lg:grid-cols-2">
          <Card>
            <CardHeader title={t('chartOverTime')} />
            <CardBody>
              <ReportsOverTimeChart data={overTime} emptyLabel={t('chartEmpty')} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('chartCategory')} />
            <CardBody>
              <NamedBarChart data={categoryChart} emptyLabel={t('chartEmpty')} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('chartStatus')} />
            <CardBody>
              <StatusDistributionChart
                data={byStatus}
                emptyLabel={t('chartEmpty')}
                locale={locale}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('chartInstitution')} />
            <CardBody>
              <NamedBarChart
                data={institutionChart}
                emptyLabel={t('chartEmpty')}
                fill={colors.river[600]}
              />
            </CardBody>
          </Card>
        </section>

        <section className="mt-section">
          <h2 className="ds-section-title">{t('mapHeading')}</h2>
          <p className="mt-1 text-small text-muted-foreground">{t('mapHint')}</p>
          <div className="mt-cluster h-80 overflow-hidden rounded-xl border border-border bg-muted lg:h-[28rem]">
            {loading && mapReports.length === 0 ? (
              <MapSkeleton className="h-full" />
            ) : mapReports.length === 0 ? (
              <p className="flex h-full items-center justify-center text-small text-muted-foreground">
                {t('mapEmpty')}
              </p>
            ) : (
              <ReportsMap
                reports={mapReports}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  router.push(`/reports/${id}`);
                }}
                className="h-full min-h-0"
              />
            )}
          </div>
        </section>

        <section className="mt-section space-y-gutter">
          <div>
            <h2 className="ds-section-title">{t('tableHeading')}</h2>
            <p className="mt-1 text-small text-muted-foreground">{t('tableSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-cluster sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <Label htmlFor="admin-status">{t('filterStatus')}</Label>
              <Select id="admin-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('filterStatusAll')}</option>
                {REPORT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {getStatusLabel(value, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-category">{t('filterCategory')}</Label>
              <Select
                id="admin-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">{t('filterCategoryAll')}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-priority">{t('filterPriority')}</Label>
              <Select
                id="admin-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">{t('filterPriorityAll')}</option>
                {REPORT_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {getPriorityLabel(value, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-institution">{t('filterInstitution')}</Label>
              <Select
                id="admin-institution"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                <option value="">{t('filterInstitutionAll')}</option>
                {institutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="admin-from">{t('filterFrom')}</Label>
              <Input
                id="admin-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="admin-to">{t('filterTo')}</Label>
              <Input id="admin-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {error ? <ErrorBanner message={error} onRetry={() => void loadDashboard()} /> : null}
          <p className="text-caption text-muted-foreground">
            {t('tableCount', { total: metaTotal })}
          </p>
          <p className="text-caption text-muted-foreground lg:hidden">{t('tableScrollHint')}</p>

          <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
            <Table className="min-w-[64rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colId')}</TableHead>
                  <TableHead>{t('colCategory')}</TableHead>
                  <TableHead>{t('colLocation')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colPriority')}</TableHead>
                  <TableHead>{t('colInstitution')}</TableHead>
                  <TableHead>{t('colCreated')}</TableHead>
                  <TableHead className="min-w-[11rem]">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && reports.length === 0 ? (
                  Array.from({ length: 6 }, (_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : !loading && reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6">
                      <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id} className="align-middle">
                      <TableCell className="font-mono text-caption text-muted-foreground">
                        {report.publicId}
                      </TableCell>
                      <TableCell>{report.categoryName ?? '—'}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-small">
                        {formatLocation(report)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell>
                        {report.priority ? <PriorityBadge priority={report.priority} /> : '—'}
                      </TableCell>
                      <TableCell>{report.institutionName ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-caption text-muted-foreground">
                        {new Date(report.createdAt).toLocaleString(dateLocale)}
                      </TableCell>
                      <TableCell>
                        <AdminReportActions
                          report={report}
                          busy={rowBusy === report.id}
                          canAssign={canAssign}
                          categories={categories}
                          departments={departments}
                          institutions={institutions}
                          staff={staff}
                          onAssign={(patch) => handleAssign(report, patch)}
                          onStatus={(body) => handleStatus(report, body)}
                          onPriority={(body) => handlePriority(report, body)}
                          onModerate={(body) => handleModerate(report, body)}
                          onNote={(note) => handleNote(report, note)}
                          onEscalate={(note) => handleEscalate(report, note)}
                          onResolve={() => handleResolve(report)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
