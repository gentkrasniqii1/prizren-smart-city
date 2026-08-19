'use client';

import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { REPORT_STATUSES, getStatusLabel, type ReportStatusKey } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

/**
 * One chip per standardized report status. Colors are unique so operators can
 * scan a table without reading the label.
 */
const STATUS_CLASS: Record<ReportStatusKey, string> = {
  SUBMITTED: 'bg-status-submitted text-status-submitted-foreground',
  RECEIVED: 'bg-status-received text-status-received-foreground',
  UNDER_REVIEW: 'bg-status-review text-status-review-foreground',
  ASSIGNED: 'bg-status-assigned text-status-assigned-foreground',
  IN_PROGRESS: 'bg-status-progress text-status-progress-foreground',
  WAITING_FOR_INFORMATION: 'bg-status-waiting text-status-waiting-foreground',
  RESOLVED: 'bg-status-resolved text-status-resolved-foreground',
  REJECTED: 'bg-status-rejected text-status-rejected-foreground',
  DUPLICATE: 'bg-status-duplicate text-status-duplicate-foreground',
};

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-caption font-semibold tracking-wide';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const locale = useLocale() as AppLocale;
  const key = (REPORT_STATUSES as readonly string[]).includes(status)
    ? (status as ReportStatusKey)
    : 'SUBMITTED';
  const classes = STATUS_CLASS[key];

  return (
    <span className={cn(badgeBase, classes, className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {getStatusLabel(status, locale)}
    </span>
  );
}
