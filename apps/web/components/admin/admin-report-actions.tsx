'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AssignReportRequest,
  DepartmentDto,
  InstitutionDto,
  Priority,
  PublicUser,
  ReportDto,
  ReportStatus,
  UpdateReportPriorityRequest,
  UpdateReportStatusRequest,
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

type Action = 'assign' | 'status' | 'priority' | 'note' | 'escalate' | 'resolve' | null;

export function AdminReportActions({
  report,
  busy,
  canAssign,
  departments,
  institutions,
  staff,
  onAssign,
  onStatus,
  onPriority,
  onNote,
  onEscalate,
  onResolve,
}: {
  report: ReportDto;
  busy: boolean;
  canAssign: boolean;
  departments: DepartmentDto[];
  institutions: InstitutionDto[];
  staff: PublicUser[];
  onAssign: (patch: AssignReportRequest) => Promise<void>;
  onStatus: (body: UpdateReportStatusRequest) => Promise<void>;
  onPriority: (body: UpdateReportPriorityRequest) => Promise<void>;
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

  function open(next: Action) {
    setInstitutionId(report.institutionId ?? '');
    setDepartmentId(report.departmentId ?? '');
    setStaffId(report.assignedStaffId ?? '');
    setStatus(report.status);
    setPriority(report.priority ?? 'MEDIUM');
    setNote('');
    setAction(next);
  }

  const closed = report.status === 'RESOLVED' || report.status === 'REJECTED';
  const needsAfterPhoto = !report.photoAfterUrl;

  return (
    <>
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
          <DropdownMenuItem asChild>
            <Link href={`/reports/${report.id}`}>{t('actionView')}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canAssign ? (
            <DropdownMenuItem onSelect={() => open('assign')}>{t('actionAssign')}</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => open('status')}>{t('actionStatus')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('priority')}>
            {t('actionPriority')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('note')}>{t('actionNote')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('escalate')} disabled={closed}>
            {t('actionEscalate')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => open('resolve')} disabled={closed}>
            {t('actionResolve')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <DialogDescription>{t('statusBody', { id: report.publicId })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`status-${report.id}`}>{t('filterStatus')}</Label>
              <Select
                id={`status-${report.id}`}
                value={status}
                onChange={(e) => setStatus(e.target.value as ReportStatus)}
              >
                {REPORT_STATUSES.map((value) => (
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
