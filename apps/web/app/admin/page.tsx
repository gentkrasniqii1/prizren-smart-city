'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { EmptyState, ErrorBanner, Skeleton, Spinner } from '@/components/ui';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';

const CategoryBarChart = dynamic(
  () => import('@/components/category-bar-chart').then((m) => m.CategoryBarChart),
  {
    ssr: false,
    loading: function ChartSkeleton() {
      return <div className="h-64 animate-pulse bg-stone-200" />;
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

function formatHours(hours: number | null) {
  if (hours == null) return '—';
  if (hours < 24) return `${hours} orë`;
  return `${(hours / 24).toFixed(1)} ditë`;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
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
      setError(err instanceof ApiError ? err.message : 'Nuk u ngarkua dashboard');
    } finally {
      setLoading(false);
    }
  }, [reportQuery, analyticsQuery]);

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
      setMessage(`Statusi i ${updated.id.slice(0, 8)} → ${updated.status}`);
      await refreshAnalytics();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ndryshimi i statusit deshtoi');
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
        `Caktimi u ruajt për ${updated.id.slice(0, 8)}${
          updated.dueAt ? ` · due ${new Date(updated.dueAt).toLocaleString('sq-AL')}` : ''
        }`,
      );
      await refreshAnalytics();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Caktimi deshtoi');
    } finally {
      setRowBusy(null);
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <Spinner />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </main>
    );
  }

  if (!user || !isStaff(user.role)) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-stone-900">Admin</h1>
        <p className="mt-3 text-stone-600">
          Kjo faqe është vetëm për stafin dhe administratorët e departamenteve.
        </p>
        <Link href="/login" className="mt-6 inline-block text-stone-900 underline">
          Hyr në llogari
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Admin dashboard</h1>
          <p className="mt-1 text-sm text-stone-600">
            Filtra, status inline dhe analytics nga baza e të dhënave — pa reload të plotë.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          Rifresko
        </button>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={summary?.total ?? '—'} />
        <StatCard label="Pending" value={summary?.pending ?? '—'} />
        <StatCard label="Resolved" value={summary?.resolved ?? '—'} />
        <StatCard label="Avg. zgjidhje" value={formatHours(summary?.avgResolutionHours ?? null)} />
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="SLA overdue" value={sla?.overdue ?? '—'} />
        <StatCard label="SLA due soon" value={sla?.dueSoon ?? '—'} />
        <StatCard label="SLA on time" value={sla?.onTime ?? '—'} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-stone-900">Raporte sipas kategorisë</h2>
        <div className="mt-3">
          <CategoryBarChart data={byCategory} />
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-medium text-stone-900">Raporte</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Status — të gjitha</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Kategori — të gjitha</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Departament — të gjitha</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
            aria-label="Nga data"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
            aria-label="Deri më"
          />
        </div>

        {error && <ErrorBanner message={error} onRetry={() => void loadDashboard()} />}
        {message && <p className="text-sm text-emerald-800">{message}</p>}
        {loading && <Spinner label="Duke filtruar…" />}
        <p className="text-xs text-stone-500">{metaTotal} raporte (max 50 në tabelë)</p>
        <p className="text-xs text-stone-500 md:hidden">
          Në celular, rrëshqit tabelën majtas/djathtas për të parë të gjitha kolonat.
        </p>

        <div className="-mx-4 overflow-x-auto border-y border-stone-200 bg-white sm:mx-0 sm:border sm:border-stone-200">
          <table className="min-w-[720px] w-full text-left text-sm md:min-w-full">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Departament</th>
                {canAssign && <th className="px-3 py-2 font-medium">Staf</th>}
                <th className="px-3 py-2 font-medium">SLA</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Detaj</th>
              </tr>
            </thead>
            <tbody>
              {!loading && reports.length === 0 ? (
                <tr>
                  <td colSpan={canAssign ? 8 : 7} className="px-3 py-6">
                    <EmptyState
                      title="Nuk ka raporte për këto filtra"
                      description="Ndrysho filtrat ose rifresko dashboard-in."
                    />
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
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
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
                          >
                            <option value="">Pa departament</option>
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
                      {canAssign && (
                        <td className="px-3 py-2">
                          <select
                            value={report.assignedStaffId ?? ''}
                            disabled={busy}
                            onChange={(e) =>
                              void assignReport(report, { assignedStaffId: e.target.value })
                            }
                            className="max-w-[11rem] rounded border border-stone-300 bg-white px-1.5 py-1 text-xs"
                          >
                            <option value="">Pa staf</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${slaClass(bucket)}`}
                        >
                          {slaLabel(bucket)}
                        </span>
                        {report.dueAt ? (
                          <div className="mt-1 text-[10px] text-stone-500">
                            {new Date(report.dueAt).toLocaleString('sq-AL')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-600">
                        {new Date(report.createdAt).toLocaleDateString('sq-AL')}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/reports/${report.id}`}
                          className="text-xs text-stone-900 underline"
                        >
                          Hap
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
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
    </div>
  );
}
