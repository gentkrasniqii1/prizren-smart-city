'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  OutboundEmailDto,
  OutboundEmailStatus,
  PaginatedOutboundEmails,
} from '@prizren/shared-types';
import { OUTBOUND_EMAIL_STATUSES } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { LIVE_POLL_MS, usePolling } from '@/lib/use-polling';
import { PageContainer } from '@/components/layout/page-container';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Badge, Button, EmptyState, ErrorBanner, FilterTabs } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeletons';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';

const RETRYABLE: OutboundEmailStatus[] = [
  'NOT_CONFIGURED',
  'QUEUED',
  'FAILED',
  'RETRYING',
  'PERMANENTLY_FAILED',
];

function isStaff(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

function canRetryRole(role?: string) {
  return role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

function linkStatus(row: OutboundEmailDto): 'active' | 'revoked' | 'expired' | null {
  if (!row.accessTokenId) return null;
  if (row.accessTokenRevokedAt) return 'revoked';
  if (row.accessTokenExpiresAt && Date.parse(row.accessTokenExpiresAt) <= Date.now()) {
    return 'expired';
  }
  return 'active';
}

function canRevokeLink(row: OutboundEmailDto) {
  return linkStatus(row) === 'active';
}

function statusTone(
  status: OutboundEmailStatus,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'SENT' || status === 'ACCEPTED') return 'success';
  if (status === 'FAILED' || status === 'PERMANENTLY_FAILED') return 'danger';
  if (status === 'RETRYING' || status === 'QUEUED' || status === 'SENDING') return 'warning';
  return 'neutral';
}

export function OutboundMailLedger() {
  const t = useTranslations('OutboundMail');
  const tAdmin = useTranslations('Admin');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [status, setStatus] = useState<OutboundEmailStatus | 'all'>('all');
  const [rows, setRows] = useState<OutboundEmailDto[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<OutboundEmailDto | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<OutboundEmailDto | null>(null);
  const [busy, setBusy] = useState(false);

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
        const params = new URLSearchParams({ limit: '50' });
        if (status !== 'all') params.set('status', status);
        const res = await apiFetch<PaginatedOutboundEmails>(
          `/outbound-emails?${params.toString()}`,
          {
            auth: true,
          },
        );
        setRows(res.data);
        setTotal(res.meta.total);
        setEnabled(res.meta.enabled);
      } catch (err) {
        if (!opts?.background) {
          setError(errorMessage(err, t('loadError')));
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [status, errorMessage, t],
  );

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void load();
  }, [authLoading, user?.role, load]);

  useRealtimeRefresh(
    () => {
      if (!busy) void load({ background: true });
    },
    !authLoading && isStaff(user?.role),
  );

  usePolling(
    () => {
      if (!busy) void load({ background: true });
    },
    LIVE_POLL_MS,
    !authLoading && isStaff(user?.role),
  );

  async function retry() {
    if (!retryTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/outbound-emails/${retryTarget.id}/retry`, { method: 'POST', auth: true });
      toast.push(t('retryDone'), 'success');
      setRetryTarget(null);
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('retryFailed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!revokeTarget?.accessTokenId) return;
    setBusy(true);
    try {
      await apiFetch(`/institution-access/${revokeTarget.accessTokenId}/revoke`, {
        method: 'POST',
        auth: true,
      });
      toast.push(t('revokeDone'), 'success');
      setRevokeTarget(null);
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('revokeFailed')), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !isStaff(user?.role)) {
    return (
      <main>
        <TableSkeleton />
      </main>
    );
  }

  const filterOptions = [
    { id: 'all' as const, label: t('filterAll') },
    ...OUTBOUND_EMAIL_STATUSES.map((item) => ({
      id: item,
      label: t(`statuses.${item}`),
    })),
  ];

  return (
    <main className="bg-muted/30 pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs
          items={[
            { href: '/', label: tAdmin('crumbHome') },
            { href: '/admin', label: tAdmin('title') },
            { label: t('title') },
          ]}
        />

        <header className="max-w-3xl">
          <p className="ds-kicker">{t('kicker')}</p>
          <h1 className="ds-page-title mt-2">{t('title')}</h1>
          <p className="mt-1 text-small text-muted-foreground">{t('subtitle')}</p>
        </header>

        <p
          className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          role="status"
        >
          {enabled ? t('flagOn') : t('flagOff')}
        </p>

        <FilterTabs
          className="mt-6"
          value={status}
          onChange={setStatus}
          label={t('filterLabel')}
          options={filterOptions}
        >
          {error ? (
            <div className="mb-6">
              <ErrorBanner title={t('loadError')} message={error} onRetry={() => void load()} />
            </div>
          ) : null}

          {loading ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" aria-hidden />}
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colCase')}</TableHead>
                  <TableHead>{t('colInstitution')}</TableHead>
                  <TableHead>{t('colRecipient')}</TableHead>
                  <TableHead>{t('colStatus')}</TableHead>
                  <TableHead>{t('colAttempts')}</TableHead>
                  <TableHead>{t('colReason')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const link = linkStatus(row);
                  const reason = row.skipReason
                    ? t(`skipReasons.${row.skipReason}`)
                    : link === 'revoked'
                      ? t('linkRevoked')
                      : link === 'expired'
                        ? t('linkExpired')
                        : link === 'active'
                          ? t('linkActive')
                          : (row.lastError ?? '—');
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/reports/${row.reportId}`}
                          className="font-medium text-foreground"
                        >
                          {row.publicId}
                        </Link>
                      </TableCell>
                      <TableCell>{row.institutionName ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.recipient ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusTone(row.status)}>{t(`statuses.${row.status}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.attemptCount}/{row.maxAttempts}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                        {reason}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canRetryRole(user?.role) && RETRYABLE.includes(row.status) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setRetryTarget(row)}
                            >
                              {t('retry')}
                            </Button>
                          ) : null}
                          {canRetryRole(user?.role) && canRevokeLink(row) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setRevokeTarget(row)}
                            >
                              {t('revoke')}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <p className="mt-4 text-caption text-muted-foreground">
            {t('showing', { count: rows.length, total })}
          </p>
        </FilterTabs>
      </PageContainer>

      <ConfirmDialog
        open={Boolean(retryTarget)}
        onOpenChange={(open) => !open && setRetryTarget(null)}
        title={t('retryTitle')}
        description={t('retryBody', { id: retryTarget?.publicId ?? '' })}
        confirmLabel={t('retry')}
        loading={busy}
        onConfirm={() => void retry()}
      />
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={t('revokeTitle')}
        description={t('revokeBody', { id: revokeTarget?.publicId ?? '' })}
        confirmLabel={t('revoke')}
        loading={busy}
        onConfirm={() => void revoke()}
      />
    </main>
  );
}
