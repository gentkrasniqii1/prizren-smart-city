'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, FilePlus2, FileText, LayoutDashboard, LogOut, Map } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  MyReportStats,
  NotificationDto,
  PaginatedNotifications,
  PaginatedReports,
  ReportDto,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { usePolling } from '@/lib/use-polling';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { PageContainer } from '@/components/layout/page-container';
import { ReportCard } from '@/components/reports/report-card';
import { NotificationItem } from '@/components/notifications/notification-item';
import { UserAvatar } from '@/components/user-avatar';
import { Button, EmptyState, ErrorBanner, StatCard } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useErrorMessage } from '@/lib/use-error-message';
import {
  AccountPageSkeleton,
  MetricGridSkeleton,
  NotificationItemSkeleton,
  ReportCardListSkeleton,
} from '@/components/ui/skeletons';
import { getRoleLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { TwoFactorSettings } from '@/components/account/two-factor-settings';
import { ProfileSettings } from '@/components/account/profile-settings';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import type { AppLocale } from '@/i18n/request';

const OPEN_STATUSES = new Set([
  'PENDING',
  'IN_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
]);

type ReportFilter = 'all' | 'open' | 'resolved';

function isStaffRole(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

export function AccountDashboard() {
  const t = useTranslations('Account');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  const [reports, setReports] = useState<ReportDto[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [stats, setStats] = useState<MyReportStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>('all');

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      setReportsLoading(true);
      setReportsError(null);
      try {
        const [res, statsRes] = await Promise.all([
          apiFetch<PaginatedReports>('/reports/mine?limit=50', { auth: true }),
          apiFetch<MyReportStats>('/reports/mine/stats', { auth: true }),
        ]);
        if (cancelled) return;
        setReports(res.data);
        setTotalReports(res.meta.total);
        setStats(statsRes);
      } catch (err) {
        if (!cancelled) {
          setReportsError(errorMessage(err, t('reportsLoadError')));
        }
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, t]);

  const refreshLive = useCallback(() => {
    void apiFetch<PaginatedReports>('/reports/mine?limit=50', { auth: true })
      .then((res) => {
        setReports(res.data);
        setTotalReports(res.meta.total);
      })
      .catch(() => undefined);
    void apiFetch<MyReportStats>('/reports/mine/stats', { auth: true })
      .then((res) => setStats(res))
      .catch(() => undefined);
    void apiFetch<PaginatedNotifications>('/notifications?limit=5', { auth: true })
      .then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.meta.unreadCount);
      })
      .catch(() => undefined);
  }, []);

  // New reports and status changes (e.g. staff resolving an issue) should
  // appear here without a manual page refresh.
  usePolling(refreshLive, 20_000, Boolean(user) && !authLoading);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      setNotifLoading(true);
      try {
        const res = await apiFetch<PaginatedNotifications>('/notifications?limit=5', {
          auth: true,
        });
        if (cancelled) return;
        setNotifications(res.data);
        setUnreadCount(res.meta.unreadCount);
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || reportsLoading) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash !== '#reports' && hash !== '#profile') return;
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [authLoading, user, reportsLoading]);

  const visibleReports = useMemo(() => {
    if (filter === 'open') return reports.filter((r) => OPEN_STATUSES.has(r.status));
    if (filter === 'resolved') return reports.filter((r) => r.status === 'RESOLVED');
    return reports;
  }, [reports, filter]);

  async function handleLogoutAll() {
    setLoggingOutAll(true);
    try {
      await apiFetch('/auth/logout-all', { method: 'POST', auth: true });
      toast.push(t('logoutAllSuccess'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('logoutAllFailed')), 'error');
      setLoggingOutAll(false);
      return;
    }
    setLogoutAllOpen(false);
    await logout();
    router.push('/login');
  }

  if (authLoading || !user) {
    return (
      <main>
        <AccountPageSkeleton label={t('loading')} />
      </main>
    );
  }

  const staff = isStaffRole(user.role);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="default">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <UserAvatar name={user.name} size={56} />
            <div>
              <p className="text-sm text-stone-600">{t('greeting')}</p>
              <h1 className="text-h1 tracking-tight text-foreground sm:text-3xl">
                {t('welcome', { name: firstName })}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                {getRoleLabel(user.role, locale)} · {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/report"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden />
              {t('ctaReport')}
            </Link>
            <Link
              href="/notifications"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-card px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-muted"
            >
              <Bell className="h-4 w-4" aria-hidden />
              {t('ctaNotifications')}
              {unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Link>
          </div>
        </header>

        {/* Quick links */}
        <nav aria-label={t('quickNav')} className="mt-6 flex flex-wrap gap-2">
          <QuickLink href="/reports" icon={Map} label={t('quickMap')} />
          <QuickLink href="#reports" icon={FileText} label={t('quickMyReports')} />
          {staff ? (
            <QuickLink href="/admin" icon={LayoutDashboard} label={t('quickAdmin')} />
          ) : null}
        </nav>

        {/* Stats */}
        <section aria-labelledby="account-stats-heading" className="mt-8">
          <h2 id="account-stats-heading" className="sr-only">
            {t('statsHeading')}
          </h2>
          {reportsLoading ? (
            <MetricGridSkeleton count={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('statTotal')}
                value={totalReports}
                hint={
                  totalReports > reports.length
                    ? t('statSampleHint', { shown: reports.length })
                    : undefined
                }
              />
              <StatCard label={t('statOpen')} value={stats.open} hint={t('statOpenHint')} />
              <StatCard label={t('statInProgress')} value={stats.inProgress} />
              <StatCard label={t('statResolved')} value={stats.resolved} />
            </div>
          )}
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)] lg:items-start">
          {/* My reports */}
          <section id="reports" aria-labelledby="account-reports-heading" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="account-reports-heading"
                  className="font-display text-xl tracking-tight text-stone-950"
                >
                  {t('reportsHeading')}
                </h2>
                <p className="mt-1 text-sm text-stone-600">{t('reportsSubtitle')}</p>
              </div>
              <div
                className="inline-flex rounded-md border border-stone-200 bg-card p-0.5"
                role="group"
                aria-label={t('filterLabel')}
              >
                {(
                  [
                    ['all', t('filterAll')],
                    ['open', t('filterOpen')],
                    ['resolved', t('filterResolved')],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={cn(
                      'rounded px-2.5 py-1 text-xs font-medium transition',
                      filter === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-stone-600 hover:bg-muted',
                    )}
                    aria-pressed={filter === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {reportsError ? <ErrorBanner className="mt-4" message={reportsError} /> : null}

            {reportsLoading ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-card">
                <ReportCardListSkeleton count={4} compact />
              </div>
            ) : visibleReports.length === 0 ? (
              <EmptyState
                className="mt-4"
                title={filter === 'all' ? t('emptyTitle') : t('emptyFilteredTitle')}
                description={filter === 'all' ? t('emptyBody') : t('emptyFilteredBody')}
                action={
                  filter === 'all' ? (
                    <Link
                      href="/report"
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
                    >
                      {t('ctaReport')}
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-card">
                {visibleReports.map((report) => (
                  <li key={report.id}>
                    <ReportCard report={report} compact />
                  </li>
                ))}
              </ul>
            )}

            {!reportsLoading && totalReports > reports.length ? (
              <p className="mt-3 text-xs text-stone-600">
                {t('showingOf', { shown: reports.length, total: totalReports })}
              </p>
            ) : null}

            {!reportsLoading ? (
              <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-dashed border-mosque-300 bg-mosque-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mosque-100 text-mosque-800">
                    <FilePlus2 className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold tracking-tight text-foreground">
                      {t('ctaCardTitle')}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{t('ctaCardBody')}</p>
                  </div>
                </div>
                <Link
                  href="/report"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
                >
                  <FilePlus2 className="h-4 w-4" aria-hidden />
                  {t('ctaCardCta')}
                </Link>
              </div>
            ) : null}
          </section>

          {/* Sidebar: notifications + profile */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            <section
              aria-labelledby="account-notif-heading"
              className="rounded-xl border border-stone-200 bg-card p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="account-notif-heading"
                  className="font-display text-lg tracking-tight text-stone-950"
                >
                  {t('notifHeading')}
                </h2>
                {unreadCount > 0 ? (
                  <span className="rounded-md bg-mosque-100 px-2 py-0.5 text-[11px] font-semibold text-mosque-900">
                    {t('notifUnread', { count: unreadCount })}
                  </span>
                ) : null}
              </div>

              {notifLoading ? (
                <div className="mt-3">
                  <NotificationItemSkeleton compact />
                  <NotificationItemSkeleton compact />
                  <NotificationItemSkeleton compact />
                </div>
              ) : notifications.length === 0 ? (
                <p className="mt-3 text-sm text-stone-600">{t('notifEmpty')}</p>
              ) : (
                <ul className="-mx-2 mt-3 divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-100">
                  {notifications.map((n) => (
                    <NotificationItem key={n.id} notification={n} compact />
                  ))}
                </ul>
              )}

              <Link
                href="/notifications"
                className="mt-4 inline-block text-sm font-medium text-mosque-800 hover:underline"
              >
                {t('notifViewAll')}
              </Link>
            </section>

            <section
              id="profile"
              aria-labelledby="account-profile-heading"
              className="scroll-mt-24 rounded-xl border border-stone-200 bg-card p-5"
            >
              <h2
                id="account-profile-heading"
                className="font-display text-lg tracking-tight text-stone-950"
              >
                {t('profileHeading')}
              </h2>
              <ProfileSettings
                user={user}
                roleLabel={getRoleLabel(user.role, locale)}
                memberSince={new Date(user.createdAt).toLocaleDateString(
                  locale === 'en' ? 'en-GB' : 'sq-AL',
                  { year: 'numeric', month: 'long', day: 'numeric' },
                )}
              />

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void logout().then(() => router.push('/'))}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {t('logout')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLogoutAllOpen(true)}
                >
                  {t('logoutAllCta')}
                </Button>
              </div>
            </section>
            <ChangePasswordForm user={user} />
            <TwoFactorSettings enabled={Boolean(user.totpEnabled)} />
          </aside>
        </div>
      </PageContainer>
      <ConfirmDialog
        open={logoutAllOpen}
        onOpenChange={setLogoutAllOpen}
        title={t('logoutAllConfirmTitle')}
        description={t('logoutAllConfirm')}
        confirmLabel={t('logoutAllCta')}
        tone="destructive"
        loading={loggingOutAll}
        onConfirm={() => void handleLogoutAll()}
      />
    </main>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof Map; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-card px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-mosque-300 hover:text-mosque-800"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
}
