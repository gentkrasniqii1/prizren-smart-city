'use client';

import Link from 'next/link';
import { Database } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AdminDataPage,
  AdminDataResource,
  AdminDataRow,
  CategoryDto,
  DepartmentDto,
  SlaPolicyDto,
  UpsertSlaPolicyRequest,
} from '@prizren/shared-types';
import { ADMIN_DATA_RESOURCES } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { LIVE_POLL_MS, usePolling } from '@/lib/use-polling';
import { useToast } from '@/components/toast-provider';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  FormError,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardSkeleton, TableSkeleton } from '@/components/ui/skeletons';
import {
  REPORT_PRIORITIES,
  REPORT_STATUSES,
  USER_ROLES,
  getRoleLabel,
  getStatusLabel,
} from '@/lib/labels';
import { useErrorMessage } from '@/lib/use-error-message';
import type { AppLocale } from '@/i18n/request';

/** Column order matches AdminDataService serializers — every schema scalar except secrets / PostGIS. */
const RESOURCE_COLUMNS: Record<AdminDataResource, readonly string[]> = {
  users: [
    'id',
    'email',
    'googleId',
    'facebookId',
    'name',
    'firstName',
    'lastName',
    'phone',
    'role',
    'emailVerified',
    'emailVerifiedAt',
    'totpEnabled',
    'failedLoginCount',
    'lockedUntil',
    'lastLoginAt',
    'lastLoginIp',
    'createdAt',
    'departmentIds',
    'departmentNames',
  ],
  reports: [
    'id',
    'publicId',
    'userId',
    'userEmail',
    'categoryId',
    'categoryName',
    'subcategoryId',
    'subcategory',
    'departmentId',
    'departmentName',
    'institutionId',
    'institutionName',
    'description',
    'status',
    'priority',
    'lat',
    'lng',
    'address',
    'photoUrl',
    'photoAfterUrl',
    'aiClassification',
    'aiConfidence',
    'duplicateOfId',
    'isDuplicate',
    'assignedStaffId',
    'assignedStaffEmail',
    'source',
    'anonymous',
    'language',
    'dueAt',
    'createdAt',
    'updatedAt',
  ],
  institutions: [
    'id',
    'name',
    'slug',
    'type',
    'phone',
    'contact',
    'active',
    'integrationType',
    'integrationStatus',
    'createdAt',
  ],
  departments: ['id', 'name', 'contact', 'slaHours', 'institutionId', 'institutionName'],
  categories: ['id', 'name', 'departmentId', 'departmentName', 'slaHours', 'defaultPriority'],
  subcategories: ['id', 'name', 'categoryId', 'categoryName', 'active', 'createdAt', 'updatedAt'],
  zones: ['id', 'name', 'active', 'createdAt', 'updatedAt'],
  'routing-rules': [
    'id',
    'name',
    'categoryId',
    'categoryName',
    'subcategoryId',
    'subcategory',
    'severity',
    'zoneId',
    'zone',
    'isEmergency',
    'departmentId',
    'departmentName',
    'institutionId',
    'institutionName',
    'priority',
    'slaHours',
    'defaultPriority',
    'active',
    'createdAt',
    'updatedAt',
  ],
  'sla-policies': [
    'id',
    'name',
    'priority',
    'responseTime',
    'resolutionTime',
    'departmentId',
    'departmentName',
    'categoryId',
    'categoryName',
    'active',
    'createdAt',
    'updatedAt',
  ],
  'audit-logs': [
    'id',
    'userId',
    'userEmail',
    'actorType',
    'action',
    'entityType',
    'entityId',
    'oldValue',
    'newValue',
    'metadata',
    'ipAddress',
    'userAgent',
    'createdAt',
  ],
  'status-history': ['id', 'reportId', 'oldStatus', 'newStatus', 'changedBy', 'note', 'changedAt'],
};

const READ_ONLY = new Set<AdminDataResource>(['audit-logs', 'status-history']);

const COLUMN_OVERRIDES: Record<string, string> = {
  id: 'ID',
  userId: 'User ID',
  googleId: 'Google ID',
  facebookId: 'Facebook ID',
  categoryId: 'Category ID',
  subcategoryId: 'Subcategory ID',
  departmentId: 'Department ID',
  institutionId: 'Institution ID',
  assignedStaffId: 'Assigned Staff ID',
  duplicateOfId: 'Duplicate Of ID',
  entityId: 'Entity ID',
  reportId: 'Report ID',
  slaHours: 'SLA Hours',
  aiClassification: 'AI Classification',
  aiConfidence: 'AI Confidence',
  ipAddress: 'IP Address',
  userAgent: 'User Agent',
  totpEnabled: 'TOTP Enabled',
};

function humanizeColumn(col: string): string {
  if (COLUMN_OVERRIDES[col]) return COLUMN_OVERRIDES[col];
  return col.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function stringifyCell(value: unknown): { text: string; title?: string } {
  if (value == null || value === '') return { text: '—' };
  if (typeof value === 'boolean') return { text: value ? 'true' : 'false' };
  if (typeof value === 'number') return { text: String(value) };
  if (typeof value === 'object') {
    const raw = JSON.stringify(value);
    if (raw.length > 80) return { text: `${raw.slice(0, 77)}…`, title: raw };
    return { text: raw, title: raw };
  }
  const text = String(value);
  if (text.length > 80) return { text: `${text.slice(0, 77)}…`, title: text };
  return { text };
}

export function AdminDataPanel() {
  const t = useTranslations('AdminData');
  const tAdmin = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [resource, setResource] = useState<AdminDataResource>('users');
  const [page, setPage] = useState(1);
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AdminDataPage | null>(null);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [slaDialog, setSlaDialog] = useState<SlaPolicyDto | 'new' | null>(null);
  const [deleteSla, setDeleteSla] = useState<SlaPolicyDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = RESOURCE_COLUMNS[resource];
  const readOnly = READ_ONLY.has(resource);

  const tabOptions = useMemo(
    () => ADMIN_DATA_RESOURCES.map((id) => ({ id, label: t(`resources.${id}`) })),
    [t],
  );

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!opts?.background) {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
        });
        if (q.trim()) params.set('q', q.trim());
        if (resource === 'reports' && status) params.set('status', status);
        const res = await apiFetch<AdminDataPage>(`/admin/data/${resource}?${params.toString()}`, {
          auth: true,
        });
        setPayload(res);
      } catch (err) {
        if (!opts?.background) {
          setPayload(null);
          setError(errorMessage(err, t('loadError')));
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [errorMessage, page, q, resource, status, t],
  );

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;
    void load();
  }, [load, user?.role]);

  useRealtimeRefresh(() => {
    if (!slaDialog && !deleteSla && !roleBusy) void load({ background: true });
  }, user?.role === 'SUPER_ADMIN');

  usePolling(
    () => {
      if (!slaDialog && !deleteSla && !roleBusy) void load({ background: true });
    },
    LIVE_POLL_MS,
    user?.role === 'SUPER_ADMIN',
  );

  function changeResource(next: AdminDataResource) {
    setResource(next);
    setPage(1);
    setDraftQ('');
    setQ('');
    setStatus('');
    setPayload(null);
  }

  async function changeRole(userId: string, role: string) {
    setRoleBusy(userId);
    try {
      await apiFetch(`/users/${userId}/role`, {
        method: 'PATCH',
        auth: true,
        body: { role },
      });
      toast.push(t('roleSaved'), 'success');
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('actionFailed')), 'error');
    } finally {
      setRoleBusy(null);
    }
  }

  async function confirmDeleteSla() {
    if (!deleteSla) return;
    setDeleting(true);
    try {
      await apiFetch(`/admin/data/sla-policies/${deleteSla.id}`, {
        method: 'DELETE',
        auth: true,
      });
      toast.push(t('deleted'), 'success');
      setDeleteSla(null);
      await load();
    } catch (err) {
      toast.push(errorMessage(err, t('deleteFailed')), 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) {
    return (
      <main>
        <DashboardSkeleton label={t('loading')} />
      </main>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <main className="pb-bottom-nav pt-8">
        <PageContainer width="narrow">
          <p className="ds-kicker">{t('kicker')}</p>
          <h1 className="ds-page-title mt-3">{t('title')}</h1>
          <p className="mt-cluster text-muted-foreground">{t('forbidden')}</p>
          <Button asChild className="mt-6">
            <Link href="/login">{tAdmin('loginLink')}</Link>
          </Button>
        </PageContainer>
      </main>
    );
  }

  const rows = payload?.data ?? [];
  const meta = payload?.meta;

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

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="ds-kicker">{t('kicker')}</p>
            <h1 className="ds-page-title mt-2">{t('title')}</h1>
            <p className="mt-1 text-small text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-cluster">
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin">{tAdmin('title')}</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/routing">{tAdmin('routingLink')}</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/mail">{tAdmin('mailLink')}</Link>
            </Button>
            {resource === 'sla-policies' ? (
              <Button type="button" size="sm" onClick={() => setSlaDialog('new')}>
                {t('addSla')}
              </Button>
            ) : null}
          </div>
        </div>

        <FilterTabs
          className="mt-6"
          value={resource}
          options={tabOptions}
          onChange={changeResource}
          label={t('modelsLabel')}
        >
          {readOnly ? (
            <p className="mb-4 text-small text-muted-foreground">{t('readOnlyHint')}</p>
          ) : null}

          <form
            className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(draftQ);
            }}
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor="admin-data-q">{t('search')}</Label>
              <Input
                id="admin-data-q"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </div>
            {resource === 'reports' ? (
              <div className="w-full sm:w-56">
                <Label htmlFor="admin-data-status">{t('statusFilter')}</Label>
                <Select
                  id="admin-data-status"
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                >
                  <option value="">{t('statusAny')}</option>
                  {REPORT_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {getStatusLabel(value, locale)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <Button type="submit">{t('searchSubmit')}</Button>
          </form>

          {error ? (
            <ErrorBanner className="mb-4" message={error} onRetry={() => void load()} />
          ) : null}

          {loading && !payload ? (
            <TableSkeleton rows={8} cols={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Database className="h-5 w-5" aria-hidden />}
              title={t('emptyTitle')}
              description={t('emptyBody')}
            />
          ) : (
            <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {humanizeColumn(col)}
                      </TableHead>
                    ))}
                    {resource === 'sla-policies' ? (
                      <TableHead className="text-right">{t('colActions')}</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={String(row.id ?? index)}>
                      {columns.map((col) => (
                        <TableCell key={col} className="max-w-[16rem] whitespace-nowrap text-sm">
                          {col === 'role' && resource === 'users' ? (
                            <Select
                              fieldSize="sm"
                              aria-label={t('changeRole')}
                              value={String(row.role ?? '')}
                              disabled={roleBusy === String(row.id)}
                              onChange={(e) => void changeRole(String(row.id), e.target.value)}
                            >
                              {USER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {getRoleLabel(role, locale)}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <CellValue column={col} row={row} />
                          )}
                        </TableCell>
                      ))}
                      {resource === 'sla-policies' ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSlaDialog(row as unknown as SlaPolicyDto)}
                            >
                              {t('edit')}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteSla(row as unknown as SlaPolicyDto)}
                            >
                              {t('delete')}
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {meta ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-small text-muted-foreground">
                {t('pageOf', {
                  page: meta.page,
                  totalPages: meta.totalPages,
                  total: meta.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={meta.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('prev')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={meta.page >= meta.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-caption text-muted-foreground">{t('contextHint')}</p>
        </FilterTabs>
      </PageContainer>

      <SlaPolicyDialog open={slaDialog} onClose={() => setSlaDialog(null)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleteSla)}
        onOpenChange={(open) => {
          if (!open) setDeleteSla(null);
        }}
        title={t('deleteTitle')}
        description={t('deleteHint', { name: deleteSla?.name ?? '' })}
        confirmLabel={t('delete')}
        cancelLabel={tCommon('cancel')}
        tone="destructive"
        loading={deleting}
        onConfirm={() => void confirmDeleteSla()}
      />
    </main>
  );
}

function CellValue({ column, row }: { column: string; row: AdminDataRow }) {
  const value = row[column];
  if (column === 'publicId' && row.id) {
    return (
      <Link href={`/reports/${String(row.id)}`} className="underline-offset-2 hover:underline">
        {String(value ?? '—')}
      </Link>
    );
  }
  const { text, title } = stringifyCell(value);
  return (
    <span className="block max-w-[16rem] truncate font-mono text-caption" title={title ?? text}>
      {text}
    </span>
  );
}

function SlaPolicyDialog({
  open,
  onClose,
  onSaved,
}: {
  open: SlaPolicyDto | 'new' | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('AdminData');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [responseTime, setResponseTime] = useState('60');
  const [resolutionTime, setResolutionTime] = useState('1440');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setPriority(existing?.priority ?? 'MEDIUM');
    setResponseTime(String(existing?.responseTime ?? 60));
    setResolutionTime(String(existing?.resolutionTime ?? 1440));
    setDepartmentId(existing?.departmentId ?? '');
    setCategoryId(existing?.categoryId ?? '');
    setActive(existing?.active ?? true);
    setError(null);
  }, [existing, open]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      apiFetch<DepartmentDto[]>('/departments'),
      apiFetch<CategoryDto[]>('/categories'),
    ])
      .then(([depts, cats]) => {
        setDepartments(depts);
        setCategories(cats);
      })
      .catch(() => {
        setDepartments([]);
        setCategories([]);
      });
  }, [open]);

  async function save() {
    const response = Number(responseTime);
    const resolution = Number(resolutionTime);
    if (!name.trim() || !Number.isFinite(response) || !Number.isFinite(resolution)) {
      setError(t('slaInvalid'));
      return;
    }
    setSaving(true);
    setError(null);
    const body: UpsertSlaPolicyRequest = {
      name: name.trim(),
      priority: priority as UpsertSlaPolicyRequest['priority'],
      responseTime: Math.round(response),
      resolutionTime: Math.round(resolution),
      departmentId: departmentId || null,
      categoryId: categoryId || null,
      active,
    };
    try {
      if (existing) {
        await apiFetch(`/admin/data/sla-policies/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/admin/data/sla-policies', { method: 'POST', auth: true, body });
      }
      toast.push(t('saved'), 'success');
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(open)} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? t('editSla') : t('addSla')}</DialogTitle>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="sla-name">{t('slaName')}</Label>
            <Input id="sla-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sla-priority">{t('slaPriority')}</Label>
            <Select
              id="sla-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {REPORT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="sla-response">{t('slaResponse')}</Label>
              <Input
                id="sla-response"
                type="number"
                min={1}
                value={responseTime}
                onChange={(e) => setResponseTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sla-resolution">{t('slaResolution')}</Label>
              <Input
                id="sla-resolution"
                type="number"
                min={1}
                value={resolutionTime}
                onChange={(e) => setResolutionTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="sla-dept">{t('slaDepartment')}</Label>
            <Select
              id="sla-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">{t('slaAny')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sla-cat">{t('slaCategory')}</Label>
            <Select id="sla-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('slaAny')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox id="sla-active" checked={active} onChange={setActive}>
            {t('slaActive')}
          </Checkbox>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" loading={saving} onClick={() => void save()}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
