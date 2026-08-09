import type { SlaBucket } from '@prizren/shared-types';

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

export function slaLabel(bucket: SlaBucket | null): string {
  if (bucket === 'overdue') return 'Overdue';
  if (bucket === 'due_soon') return 'Due soon';
  if (bucket === 'on_time') return 'On time';
  return '—';
}

export function slaClass(bucket: SlaBucket | null): string {
  if (bucket === 'overdue') return 'bg-red-100 text-red-900';
  if (bucket === 'due_soon') return 'bg-amber-100 text-amber-900';
  if (bucket === 'on_time') return 'bg-emerald-100 text-emerald-900';
  return 'bg-stone-100 text-stone-600';
}
