'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  canTransitionStatus,
  PRE_APPROVAL_STATUSES,
  type AssignReportRequest,
  type CategoryDto,
  type DepartmentDto,
  type InstitutionDto,
  type ModerateReportRequest,
  type Priority,
  type PublicUser,
  type ReportDto,
  type ReportStatus,
  type UpdateReportPriorityRequest,
  type UpdateReportStatusRequest,
} from '@prizren/shared-types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label, Select, Textarea } from '@/components/ui/field';
import { getPriorityLabel, getStatusLabel, REPORT_PRIORITIES, REPORT_STATUSES } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

type Action =
  'assign' | 'status' | 'priority' | 'note' | 'escalate' | 'resolve' | 'moderate' | null;

export function AdminReportActions({
  report,
  busy,
  canAssign,
  categories,
  departments,
  institutions,
  staff,
  onAssign,
  onStatus,
  onPriority,
  onModerate,
  onNote,
  onEscalate,
  onResolve,
}: {
  report: ReportDto;
  busy: boolean;
  canAssign: boolean;
  categories: CategoryDto[];
  departments: DepartmentDto[];
  institutions: InstitutionDto[];
  staff: PublicUser[];
  onAssign: (patch: AssignReportRequest) => Promise<void>;
  onStatus: (body: UpdateReportStatusRequest) => Promise<void>;
  onPriority: (body: UpdateReportPriorityRequest) => Promise<void>;
  onModerate: (body: ModerateReportRequest) => Promise<void>;
  onNote: (note: string) => Promise<void>;
  onEscalate: (note: string) => Promise<void>;
  onResolve: () => Promise<void>;
}) {
  const t = useTranslations('Admin');
  const locale = useLocale() as AppLocale;
  const [action, setAction] = useState<Action>(null);
  const [institutionId, setInstitutionId] = useState(report.institutionId ?? '');
  const [departmentId, setDepartmentId] = useState(report.departmentId ?? '');
  const [staffId, setStaffId] = useState(report.assignedStaffId ?? '');
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [priority, setPriority] = useState<Priority>(report.priority ?? 'MEDIUM');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(report.categoryId ?? '');

  function open(next: Action) {
    setInstitutionId(report.institutionId ?? '');
    setDepartmentId(report.departmentId ?? '');
    setStaffId(report.assignedStaffId ?? '');
    setStatus(report.status);
    setPriority(report.priority ?? 'MEDIUM');
    setNote('');
    setCategoryId(report.categoryId ?? '');
    setAction(next);
  }

  const closed =
    report.status === 'RESOLVED' || report.status === 'REJECTED' || report.status === 'DUPLICATE';
  const needsAfterPhoto = !report.photoAfterUrl;
  const preApproval = PRE_APPROVAL_STATUSES.includes(report.status);
  const statusChoices = REPORT_STATUSES.filter((value) => {
    if (value === report.status) return true;
    if (preApproval && value === 'ASSIGNED') return false;
    return canTransitionStatus(report.status, value);
  });

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {preApproval ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => open('moderate')}>
            {t('actionReview')}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="icon"
              size="sm"
              disabled={busy}
              aria-label={t('colActions')}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {preApproval ? (
              <DropdownMenuItem onSelect={() => open('moderate')}>
                {t('actionReview')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href={`/reports/${report.id}`}>
                {preApproval ? t('moderateOpenFull') : t('actionView')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {canAssign && !preApproval ? (
              <DropdownMenuItem onSelect={() => open('assign')}>
                {t('actionAssign')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => open('status')}>{t('actionStatus')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('priority')}>
              {t('actionPriority')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('note')}>{t('actionNote')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => open('escalate')} disabled={closed}>
              {t('actionEscalate')}
            </DropdownMenuItem>
            {!preApproval ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => open('resolve')} disabled={closed}>
                  {t('actionResolve')}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog
        open={action === 'moderate'}
        onOpenChange={(openState) => !openState && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('moderateTitle')}</DialogTitle>
            <DialogDescription>{t('moderateBody')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="font-mono text-caption text-muted-foreground">{report.publicId}</p>
            <div>
              <Label htmlFor={`moderate-cat-${report.id}`}>{t('moderateCategory')}</Label>
              <Select
                id={`moderate-cat-${report.id}`}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">{t('moderateCategoryPlaceholder')}</option>
                {categoryId && !categories.some((category) => category.id === categoryId) ? (
                  <option value={categoryId}>{report.categoryName ?? categoryId}</option>
                ) : null}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              {!categoryId ? (
                <p className="mt-1.5 text-caption text-muted-foreground">
                  {t('moderateNeedsCategory')}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor={`moderate-note-${report.id}`}>{t('moderateNote')}</Label>
              <Textarea
                id={`moderate-note-${report.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/reports/${report.id}`}>{t('moderateOpenFull')}</Link>
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAction(null)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={busy}
                disabled={!note.trim()}
                onClick={() => {
                  void onModerate({
                    action: 'reject_invalid',
                    note: note.trim(),
                  }).then(() => setAction(null));
                }}
              >
                {t('moderateReject')}
              </Button>
              <Button
                type="button"
                loading={busy}
                disabled={!categoryId}
                onClick={() => {
                  void onModerate({
                    action: 'approve',
                    categoryId,
                    note: note.trim() || undefined,
                  }).then(() => setAction(null));
                }}
              >
                {t('moderateApprove')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action === 'assign'}
        onOpenChange={(openState) => !openState && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assignTitle')}</DialogTitle>
            <DialogDescription>{t('assignBody', { id: report.publicId })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`assign-inst-${report.id}`}>{t('colInstitution')}</Label>
              <Select
                id={`assign-inst-${report.id}`}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                <option value="">{t('noInstitution')}</option>
                {institutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`assign-dept-${report.id}`}>{t('colDepartment')}</Label>
              <Select
                id={`assign-dept-${report.id}`}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">{t('noDepartment')}</option>
                {departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`assign-staff-${report.id}`}>{t('colStaff')}</Label>
              <Select
                id={`assign-staff-${report.id}`}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">{t('noStaff')}</option>
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void onAssign({
                  institutionId: institutionId || null,
                  departmentId: departmentId || null,
                  assignedStaffId: staffId || null,
                }).then(() => setAction(null));
              }}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action === 'status'}
        onOpenChange={(openState) => !openState && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('statusTitle')}</DialogTitle>
            <DialogDescription>
              {preApproval
                ? t('statusReviewHint', { id: report.publicId })
                : t('statusBody', { id: report.publicId })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`status-${report.id}`}>{t('filterStatus')}</Label>
              <Select
                id={`status-${report.id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value as ReportStatus)}
              >
                {statusChoices.map((value) => (
                  <option key={value} value={value}>
                    {getStatusLabel(value, locale)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`status-note-${report.id}`}>{t('noteOptional')}</Label>
              <Textarea
                id={`status-note-${report.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void onStatus({ status, note: note.trim() || undefined }).then(() =>
                  setAction(null),
                );
              }}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action === 'priority'}
        onOpenChange={(openState) => !openState && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('priorityTitle')}</DialogTitle>
            <DialogDescription>{t('priorityBody', { id: report.publicId })}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor={`priority-${report.id}`}>{t('filterPriority')}</Label>
            <Select
              id={`priority-${report.id}`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {REPORT_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {getPriorityLabel(value, locale)}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void onPriority({ priority }).then(() => setAction(null));
              }}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === 'note'} onOpenChange={(openState) => !openState && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('noteTitle')}</DialogTitle>
            <DialogDescription>{t('noteBody')}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor={`note-${report.id}`}>{t('noteLabel')}</Label>
            <Textarea
              id={`note-${report.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={500}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              disabled={!note.trim()}
              onClick={() => {
                void onNote(note.trim()).then(() => setAction(null));
              }}
            >
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={action === 'escalate'}
        onOpenChange={(openState) => !openState && setAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('escalateTitle')}</DialogTitle>
            <DialogDescription>{t('escalateBody')}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor={`escalate-note-${report.id}`}>{t('noteOptional')}</Label>
            <Textarea
              id={`escalate-note-${report.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void onEscalate(note.trim()).then(() => setAction(null));
              }}
            >
              {t('actionEscalate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {needsAfterPhoto ? (
        <Dialog
          open={action === 'resolve'}
          onOpenChange={(openState) => !openState && setAction(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('resolveBlockedTitle')}</DialogTitle>
              <DialogDescription>{t('resolveBlockedBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAction(null)}>
                {t('cancel')}
              </Button>
              <Button asChild>
                <Link href={`/reports/${report.id}`}>{t('actionView')}</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <ConfirmDialog
          open={action === 'resolve'}
          onOpenChange={(openState) => !openState && setAction(null)}
          title={t('resolveTitle')}
          description={t('resolveBody', { id: report.publicId })}
          confirmLabel={t('actionResolve')}
          loading={busy}
          onConfirm={async () => {
            await onResolve();
            setAction(null);
          }}
        />
      )}
    </>
  );
}
