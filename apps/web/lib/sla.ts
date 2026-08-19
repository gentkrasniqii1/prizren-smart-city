import type { SlaBucket } from '@prizren/shared-types';
import { getSlaLabel } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export function slaBucket(dueAt: string | null | undefined, now = new Date()): SlaBucket | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const t = due.getTime();
  const n = now.getTime();
  if (t < n) return 'overdue';
  if (t <= n + DUE_SOON_MS) return 'due_soon';
  return 'on_time';
}

export function slaLabel(bucket: SlaBucket | null, locale: AppLocale = 'sq'): string {
  return getSlaLabel(bucket, locale);
}

export function slaClass(bucket: SlaBucket | null): string {
  if (bucket === 'overdue') return 'bg-semantic-danger text-semantic-danger-foreground';
  if (bucket === 'due_soon') return 'bg-semantic-warning text-semantic-warning-foreground';
  if (bucket === 'on_time') return 'bg-semantic-success text-semantic-success-foreground';
  return 'bg-status-pending text-status-pending-foreground';
}
