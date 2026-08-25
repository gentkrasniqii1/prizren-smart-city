'use client';

import { GitBranch, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  CategoryDto,
  DepartmentDto,
  InstitutionDto,
  Priority,
  RoutePreview,
  RoutingRuleDto,
  SubcategoryDto,
} from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { LIVE_POLL_MS, usePolling } from '@/lib/use-polling';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { useToast } from '@/components/toast-provider';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorBanner,
  FormError,
  Input,
  Label,
  PriorityBadge,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { REPORT_PRIORITIES } from '@/lib/labels';
import { useErrorMessage } from '@/lib/use-error-message';

type Tab = 'rules' | 'institutions' | 'departments' | 'categories' | 'subcategories';

const STAFF_ROLES = new Set(['DEPARTMENT_STAFF', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']);
const EDIT_ROLES = new Set(['DEPARTMENT_ADMIN', 'SUPER_ADMIN']);
const INST_TYPES = ['MUNICIPALITY', 'UTILITY', 'EMERGENCY', 'OTHER'] as const;

function isStaff(role?: string) {
  return Boolean(role && STAFF_ROLES.has(role));
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseHours(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function matchesQuery(haystack: Array<string | null | undefined>, q: string): boolean {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((part) => (part ?? '').toLowerCase().includes(needle));
}

export function RoutingConfig() {
  const t = useTranslations('Routing');
  const tAdmin = useTranslations('Admin');
  const tCommon = useTranslations('Common');
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const canEdit = EDIT_ROLES.has(user?.role ?? '');
  const canDelete = user?.role === 'SUPER_ADMIN';

  const [tab, setTab] = useState<Tab>('rules');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [rules, setRules] = useState<RoutingRuleDto[]>([]);
  const [previewCategoryId, setPreviewCategoryId] = useState('');
  const [preview, setPreview] = useState<RoutePreview | null>(null);

  const [ruleDialog, setRuleDialog] = useState<RoutingRuleDto | 'new' | null>(null);
  const [instDialog, setInstDialog] = useState<InstitutionDto | 'new' | null>(null);
  const [deptDialog, setDeptDialog] = useState<DepartmentDto | 'new' | null>(null);
  const [catDialog, setCatDialog] = useState<CategoryDto | 'new' | null>(null);
  const [subDialog, setSubDialog] = useState<SubcategoryDto | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: Tab; id: string; name: string } | null>(
    null,
  );
  const [listQuery, setListQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [i, d, c, s, r] = await Promise.all([
        apiFetch<InstitutionDto[]>('/institutions?includeInactive=true', { auth: true }),
        apiFetch<DepartmentDto[]>('/departments', { auth: true }),
        apiFetch<CategoryDto[]>('/categories', { auth: true }),
        apiFetch<SubcategoryDto[]>('/subcategories?includeInactive=true', { auth: true }),
        apiFetch<RoutingRuleDto[]>('/routing-rules', { auth: true }),
      ]);
      setInstitutions(i);
      setDepartments(d);
      setCategories(c);
      setSubcategories(s);
      setRules(r);
    } catch (err) {
      setError(errorMessage(err, t('loadError')));
    } finally {
      setLoading(false);
    }
  }, [errorMessage, t]);

  useEffect(() => {
    if (authLoading || !isStaff(user?.role)) return;
    void load();
  }, [authLoading, user?.role, load]);

  const filteredRules = useMemo(
    () =>
      rules.filter((rule) =>
        matchesQuery(
          [
            rule.name,
            rule.categoryName,
            rule.subcategory,
            rule.subcategoryId,
            rule.departmentName,
            rule.institutionName,
            rule.severity,
            rule.zone,
            rule.isEmergency === true
              ? 'emergency'
              : rule.isEmergency === false
                ? 'non-emergency'
                : '',
            rule.id,
            rule.categoryId,
            rule.departmentId,
            rule.institutionId,
          ],
          listQuery,
        ),
      ),
    [listQuery, rules],
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        matchesQuery(
          [c.name, c.departmentName, c.institutionName, c.id, c.departmentId],
          listQuery,
        ),
      ),
    [categories, listQuery],
  );

  const filteredSubcategories = useMemo(
    () =>
      subcategories.filter((s) =>
        matchesQuery([s.name, s.categoryName, s.id, s.categoryId], listQuery),
      ),
    [listQuery, subcategories],
  );

  const dialogOpen = Boolean(
    ruleDialog || instDialog || deptDialog || catDialog || subDialog || deleteTarget,
  );

  useRealtimeRefresh(
    () => {
      if (!dialogOpen) void load();
    },
    !authLoading && isStaff(user?.role),
  );

  usePolling(
    () => {
      if (!dialogOpen) void load();
    },
    LIVE_POLL_MS,
    !authLoading && isStaff(user?.role),
  );

  const runPreview = useCallback(async () => {
    if (!previewCategoryId) {
      setPreview(null);
      return;
    }
    try {
      const result = await apiFetch<RoutePreview>(
        `/routing/preview?categoryId=${encodeURIComponent(previewCategoryId)}`,
        { auth: true },
      );
      setPreview(result);
    } catch (err) {
      setError(errorMessage(err, t('previewError')));
    }
  }, [errorMessage, previewCategoryId, t]);

  useEffect(() => {
    if (!isStaff(user?.role) || loading) return;
    void runPreview();
  }, [loading, runPreview, user?.role]);

  async function remove() {
    if (!deleteTarget) return;
    const path =
      deleteTarget.kind === 'rules'
        ? `/routing-rules/${deleteTarget.id}`
        : deleteTarget.kind === 'institutions'
          ? `/institutions/${deleteTarget.id}`
          : deleteTarget.kind === 'departments'
            ? `/departments/${deleteTarget.id}`
            : deleteTarget.kind === 'subcategories'
              ? `/subcategories/${deleteTarget.id}`
              : `/categories/${deleteTarget.id}`;
    try {
      await apiFetch(path, { method: 'DELETE', auth: true });
      toast.push(t('deleted'), 'success');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, t('deleteFailed')));
    }
  }

  function openCreate() {
    if (tab === 'rules') setRuleDialog('new');
    if (tab === 'institutions') setInstDialog('new');
    if (tab === 'departments') setDeptDialog('new');
    if (tab === 'categories') setCatDialog('new');
    if (tab === 'subcategories') setSubDialog('new');
  }

  if (authLoading || (isStaff(user?.role) && loading && rules.length === 0 && !error)) {
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
          <p className="mt-cluster text-muted-foreground">{tAdmin('forbidden')}</p>
          <Button asChild className="mt-6">
            <Link href="/login">{tAdmin('loginLink')}</Link>
          </Button>
        </PageContainer>
      </main>
    );
  }

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

        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="ds-kicker">{t('kicker')}</p>
            <h1 className="ds-page-title mt-2">{t('title')}</h1>
            <p className="mt-1 text-small text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-cluster">
            {user.role === 'SUPER_ADMIN' ? (
              <Button asChild variant="secondary">
                <Link href="/admin/data">{tAdmin('dataLink')}</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link href="/admin/mail">{tAdmin('mailLink')}</Link>
            </Button>
            {canEdit ? (
              <Button type="button" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                {t('add')}
              </Button>
            ) : null}
          </div>
        </header>

        {error ? (
          <ErrorBanner className="mt-4" message={error} onRetry={() => void load()} />
        ) : null}

        <Card className="mt-6">
          <CardHeader title={t('previewTitle')} description={t('previewHint')} />
          <CardBody className="grid gap-3 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-end">
            <div>
              <Label htmlFor="preview-category">{t('previewCategory')}</Label>
              <Select
                id="preview-category"
                value={previewCategoryId}
                onChange={(e) => setPreviewCategoryId(e.target.value)}
              >
                <option value="">{t('previewSelect')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {preview ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                <span className="font-medium">{preview.institutionName ?? t('unrouted')}</span>
                {preview.departmentName ? ` / ${preview.departmentName}` : ''}
                {` · ${t('hours', { n: preview.slaHours })}`}
                {` · ${preview.defaultPriority}`}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {preview.source === 'rule'
                    ? t('matchedRule', { name: preview.matchedRuleName ?? '' })
                    : preview.source === 'category_fallback'
                      ? t('matchedFallback')
                      : t('matchedNone')}
                </span>
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="rules">{t('tabRules')}</TabsTrigger>
            <TabsTrigger value="institutions">{t('tabInstitutions')}</TabsTrigger>
            <TabsTrigger value="departments">{t('tabDepartments')}</TabsTrigger>
            <TabsTrigger value="categories">{t('tabCategories')}</TabsTrigger>
            <TabsTrigger value="subcategories">{t('tabSubcategories')}</TabsTrigger>
          </TabsList>

          {tab === 'rules' || tab === 'categories' || tab === 'subcategories' ? (
            <div className="mt-4 max-w-md">
              <Label htmlFor="routing-list-q">{t('searchPlaceholder')}</Label>
              <Input
                id="routing-list-q"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </div>
          ) : null}

          <TabsContent value="rules">
            {rules.length === 0 ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" aria-hidden />}
                title={t('emptyRules')}
                description={t('emptyRulesHint')}
                action={
                  canEdit ? (
                    <Button type="button" onClick={() => setRuleDialog('new')}>
                      {t('add')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
                <Table className="min-w-[56rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colMatch')}</TableHead>
                      <TableHead>{t('colRouteTo')}</TableHead>
                      <TableHead>{t('colPriority')}</TableHead>
                      <TableHead>{t('colSla')}</TableHead>
                      <TableHead className="text-right">{t('colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">{rule.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t('order')}: {rule.priority}
                            {rule.active ? '' : ` · ${t('inactive')}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {rule.categoryName ?? t('anyCategory')}
                          {rule.subcategory ? ` · ${rule.subcategory}` : ''}
                          {rule.isEmergency ? ` · ${t('emergencyOnly')}` : ''}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[rule.institutionName, rule.departmentName]
                            .filter(Boolean)
                            .join(' / ') || t('unrouted')}
                        </TableCell>
                        <TableCell>
                          {rule.defaultPriority ? (
                            <PriorityBadge priority={rule.defaultPriority} />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {rule.slaHours != null ? t('hours', { n: rule.slaHours }) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onEdit={() => setRuleDialog(rule)}
                            onDelete={() =>
                              setDeleteTarget({ kind: 'rules', id: rule.id, name: rule.name })
                            }
                            editLabel={t('edit')}
                            deleteLabel={t('delete')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="institutions">
            <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colName')}</TableHead>
                    <TableHead>{t('colType')}</TableHead>
                    <TableHead>{t('colPhone')}</TableHead>
                    <TableHead>{t('colContact')}</TableHead>
                    <TableHead>{t('colStatus')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {institutions.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.name}</TableCell>
                      <TableCell>
                        {INST_TYPES.includes(inst.type as (typeof INST_TYPES)[number])
                          ? t(`types.${inst.type}`)
                          : inst.type}
                      </TableCell>
                      <TableCell className="text-sm">{inst.phone ?? '—'}</TableCell>
                      <TableCell className="text-sm">{inst.contact ?? '—'}</TableCell>
                      <TableCell>{inst.active ? t('active') : t('inactive')}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={() => setInstDialog(inst)}
                          onDelete={() =>
                            setDeleteTarget({ kind: 'institutions', id: inst.id, name: inst.name })
                          }
                          editLabel={t('edit')}
                          deleteLabel={t('delete')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="departments">
            <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
              <Table className="min-w-[40rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colName')}</TableHead>
                    <TableHead>{t('colInstitution')}</TableHead>
                    <TableHead>{t('colSla')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.institutionName ?? '—'}</TableCell>
                      <TableCell>
                        {d.slaHours != null ? t('hours', { n: d.slaHours }) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={() => setDeptDialog(d)}
                          onDelete={() =>
                            setDeleteTarget({ kind: 'departments', id: d.id, name: d.name })
                          }
                          editLabel={t('edit')}
                          deleteLabel={t('delete')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colName')}</TableHead>
                    <TableHead>{t('colFallbackDept')}</TableHead>
                    <TableHead>{t('colPriority')}</TableHead>
                    <TableHead>{t('colSla')}</TableHead>
                    <TableHead className="text-right">{t('colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">
                        {[c.institutionName, c.departmentName].filter(Boolean).join(' / ')}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={c.defaultPriority} />
                      </TableCell>
                      <TableCell>{t('hours', { n: c.slaHours })}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={() => setCatDialog(c)}
                          onDelete={() =>
                            setDeleteTarget({ kind: 'categories', id: c.id, name: c.name })
                          }
                          editLabel={t('edit')}
                          deleteLabel={t('delete')}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="subcategories">
            {subcategories.length === 0 ? (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" aria-hidden />}
                title={t('emptySubcategories')}
                description={t('emptySubcategoriesHint')}
                action={
                  canEdit ? (
                    <Button type="button" onClick={() => setSubDialog('new')}>
                      {t('add')}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="-mx-gutter overflow-x-auto border-y border-border bg-card sm:mx-0 sm:rounded-xl sm:border">
                <Table className="min-w-[44rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colCategory')}</TableHead>
                      <TableHead>{t('colStatus')}</TableHead>
                      <TableHead className="text-right">{t('colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubcategories.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.name}</TableCell>
                        <TableCell className="text-sm">{sub.categoryName}</TableCell>
                        <TableCell>{sub.active ? t('active') : t('inactive')}</TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onEdit={() => setSubDialog(sub)}
                            onDelete={() =>
                              setDeleteTarget({
                                kind: 'subcategories',
                                id: sub.id,
                                name: sub.name,
                              })
                            }
                            editLabel={t('edit')}
                            deleteLabel={t('delete')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <RuleDialog
          open={ruleDialog}
          institutions={institutions}
          departments={departments}
          categories={categories}
          subcategories={subcategories}
          onClose={() => setRuleDialog(null)}
          onSaved={load}
        />
        <InstitutionDialog open={instDialog} onClose={() => setInstDialog(null)} onSaved={load} />
        <DepartmentDialog
          open={deptDialog}
          institutions={institutions}
          onClose={() => setDeptDialog(null)}
          onSaved={load}
        />
        <CategoryDialog
          open={catDialog}
          departments={departments}
          onClose={() => setCatDialog(null)}
          onSaved={load}
        />
        <SubcategoryDialog
          open={subDialog}
          categories={categories}
          onClose={() => setSubDialog(null)}
          onSaved={load}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title={t('deleteTitle')}
          description={t('deleteHint', { name: deleteTarget?.name ?? '' })}
          confirmLabel={t('delete')}
          cancelLabel={tCommon('cancel')}
          tone="destructive"
          onConfirm={() => void remove()}
        />
      </PageContainer>
    </main>
  );
}

function RowActions({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  if (!canEdit && !canDelete) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex justify-end gap-2">
      {canEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          {editLabel}
        </Button>
      ) : null}
      {canDelete ? (
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}

function RuleDialog({
  open,
  institutions,
  departments,
  categories,
  subcategories,
  onClose,
  onSaved,
}: {
  open: RoutingRuleDto | 'new' | null;
  institutions: InstitutionDto[];
  departments: DepartmentDto[];
  categories: CategoryDto[];
  subcategories: SubcategoryDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Routing');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [emergency, setEmergency] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [order, setOrder] = useState('100');
  const [priority, setPriority] = useState('');
  const [slaHours, setSlaHours] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setCategoryId(existing?.categoryId ?? '');
    const matchedId =
      existing?.subcategoryId ??
      (existing?.subcategory
        ? (subcategories.find(
            (s) =>
              s.name === existing.subcategory &&
              (!existing.categoryId || s.categoryId === existing.categoryId),
          )?.id ?? '')
        : '');
    setSubcategoryId(matchedId);
    setEmergency(
      existing?.isEmergency === true ? 'true' : existing?.isEmergency === false ? 'false' : '',
    );
    setInstitutionId(existing?.institutionId ?? '');
    setDepartmentId(existing?.departmentId ?? '');
    setOrder(String(existing?.priority ?? 100));
    setPriority(existing?.defaultPriority ?? '');
    setSlaHours(existing?.slaHours != null ? String(existing.slaHours) : '');
    setActive(existing?.active ?? true);
    setError(null);
  }, [existing, open, subcategories]);

  const filteredDepts = useMemo(
    () => departments.filter((d) => !institutionId || d.institutionId === institutionId),
    [departments, institutionId],
  );

  const filteredSubs = useMemo(
    () =>
      subcategories.filter(
        (s) => (!categoryId || s.categoryId === categoryId) && (s.active || s.id === subcategoryId),
      ),
    [subcategories, categoryId, subcategoryId],
  );

  async function save() {
    setSaving(true);
    setError(null);
    const body = {
      name,
      categoryId: emptyToNull(categoryId),
      subcategoryId: emptyToNull(subcategoryId),
      subcategory: null,
      isEmergency: emergency === '' ? null : emergency === 'true',
      institutionId: emptyToNull(institutionId),
      departmentId: emptyToNull(departmentId),
      priority: Number(order) || 100,
      defaultPriority: emptyToNull(priority) as Priority | null,
      slaHours: parseHours(slaHours),
      active,
      ...(existing
        ? {
            severity: existing.severity,
            zone: existing.zone,
          }
        : {}),
    };
    try {
      if (existing) {
        await apiFetch(`/routing-rules/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/routing-rules', { method: 'POST', auth: true, body });
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
          <DialogTitle>{existing ? t('editRule') : t('newRule')}</DialogTitle>
          <DialogDescription>{t('ruleHint')}</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="rule-name">{t('colName')}</Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="rule-category">{t('matchCategory')}</Label>
            <Select
              id="rule-category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
            >
              <option value="">{t('anyCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-sub">{t('matchSubcategory')}</Label>
            <Select
              id="rule-sub"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              <option value="">{t('anySubcategory')}</option>
              {filteredSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? '' : ` (${t('inactive')})`}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-em">{t('matchEmergency')}</Label>
            <Select id="rule-em" value={emergency} onChange={(e) => setEmergency(e.target.value)}>
              <option value="">{t('anyEmergency')}</option>
              <option value="true">{t('emergencyOnly')}</option>
              <option value="false">{t('nonEmergency')}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-inst">{t('colInstitution')}</Label>
            <Select
              id="rule-inst"
              value={institutionId}
              onChange={(e) => {
                setInstitutionId(e.target.value);
                setDepartmentId('');
              }}
            >
              <option value="">{t('unrouted')}</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rule-dept">{t('colDepartment')}</Label>
            <Select
              id="rule-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">{t('anyDepartment')}</option>
              {filteredDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rule-order">{t('order')}</Label>
              <Input
                id="rule-order"
                type="number"
                min={1}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rule-pri">{t('colPriority')}</Label>
              <Select id="rule-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">{t('inherit')}</option>
                {REPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-sla">{t('colSla')}</Label>
              <Input
                id="rule-sla"
                type="number"
                min={1}
                placeholder="48"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
              />
            </div>
          </div>
          <Checkbox id="rule-active" checked={active} onChange={setActive}>
            {t('active')}
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

function InstitutionDialog({
  open,
  onClose,
  onSaved,
}: {
  open: InstitutionDto | 'new' | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Routing');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [type, setType] = useState('MUNICIPALITY');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setType(existing?.type ?? 'MUNICIPALITY');
    setPhone(existing?.phone ?? '');
    setContact(existing?.contact ?? '');
    setActive(existing?.active ?? true);
    setError(null);
  }, [existing, open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        type,
        phone: emptyToNull(phone),
        contact: emptyToNull(contact),
        active,
      };
      if (existing) {
        await apiFetch(`/institutions/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/institutions', { method: 'POST', auth: true, body });
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
          <DialogTitle>{existing ? t('editInstitution') : t('newInstitution')}</DialogTitle>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="inst-name">{t('colName')}</Label>
            <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inst-type">{t('colType')}</Label>
            <Select id="inst-type" value={type} onChange={(e) => setType(e.target.value)}>
              {INST_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t(`types.${item}`)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inst-phone">{t('colPhone')}</Label>
            <Input id="inst-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inst-contact">{t('colContact')}</Label>
            <Input
              id="inst-contact"
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <Checkbox id="inst-active" checked={active} onChange={setActive}>
            {t('active')}
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

function DepartmentDialog({
  open,
  institutions,
  onClose,
  onSaved,
}: {
  open: DepartmentDto | 'new' | null;
  institutions: InstitutionDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Routing');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [slaHours, setSlaHours] = useState('48');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setInstitutionId(existing?.institutionId ?? institutions[0]?.id ?? '');
    setSlaHours(String(existing?.slaHours ?? 48));
    setContact(existing?.contact ?? '');
    setError(null);
  }, [existing, institutions, open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        institutionId: emptyToNull(institutionId),
        slaHours: parseHours(slaHours) ?? 48,
        contact: emptyToNull(contact),
      };
      if (existing) {
        await apiFetch(`/departments/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/departments', { method: 'POST', auth: true, body });
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
          <DialogTitle>{existing ? t('editDepartment') : t('newDepartment')}</DialogTitle>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="dept-name">{t('colName')}</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dept-inst">{t('colInstitution')}</Label>
            <Select
              id="dept-inst"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            >
              <option value="">{t('unrouted')}</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="dept-sla">{t('colSla')}</Label>
            <Input
              id="dept-sla"
              type="number"
              min={1}
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dept-contact">{t('colPhone')}</Label>
            <Input
              id="dept-contact"
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
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

function CategoryDialog({
  open,
  departments,
  onClose,
  onSaved,
}: {
  open: CategoryDto | 'new' | null;
  departments: DepartmentDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Routing');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [slaHours, setSlaHours] = useState('48');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setDepartmentId(existing?.departmentId ?? departments[0]?.id ?? '');
    setPriority(existing?.defaultPriority ?? 'MEDIUM');
    setSlaHours(String(existing?.slaHours ?? 48));
    setError(null);
  }, [departments, existing, open]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        departmentId,
        defaultPriority: priority,
        slaHours: parseHours(slaHours) ?? 48,
      };
      if (existing) {
        await apiFetch(`/categories/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/categories', { method: 'POST', auth: true, body });
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
          <DialogTitle>{existing ? t('editCategory') : t('newCategory')}</DialogTitle>
          <DialogDescription>{t('categoryHint')}</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="cat-name">{t('colName')}</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cat-dept">{t('colFallbackDept')}</Label>
            <Select
              id="cat-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.institutionName, d.name].filter(Boolean).join(' / ')}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cat-pri">{t('colPriority')}</Label>
              <Select
                id="cat-pri"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {REPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cat-sla">{t('colSla')}</Label>
              <Input
                id="cat-sla"
                type="number"
                min={1}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
              />
            </div>
          </div>
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

function SubcategoryDialog({
  open,
  categories,
  onClose,
  onSaved,
}: {
  open: SubcategoryDto | 'new' | null;
  categories: CategoryDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('Routing');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = open && open !== 'new' ? open : null;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setCategoryId(existing?.categoryId ?? categories[0]?.id ?? '');
    setActive(existing?.active ?? true);
    setError(null);
  }, [categories, existing, open]);

  async function save() {
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    if (!categoryId) {
      setError(t('selectCategoryFirst'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), categoryId, active };
      if (existing) {
        await apiFetch(`/subcategories/${existing.id}`, {
          method: 'PATCH',
          auth: true,
          body,
        });
      } else {
        await apiFetch('/subcategories', { method: 'POST', auth: true, body });
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
          <DialogTitle>{existing ? t('editSubcategory') : t('newSubcategory')}</DialogTitle>
          <DialogDescription>{t('subcategoryHint')}</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <div className="grid gap-3">
          <div>
            <Label htmlFor="sub-name">{t('colName')}</Label>
            <Input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="sub-cat">{t('colCategory')}</Label>
            <Select id="sub-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 ? (
                <option value="">{t('selectCategoryFirst')}</option>
              ) : null}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox id="sub-active" checked={active} onChange={setActive}>
            {t('active')}
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
