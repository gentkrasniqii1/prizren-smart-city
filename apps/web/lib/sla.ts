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
  if (bucket === 'overdue') return 'bg-red-200 text-red-950';
  if (bucket === 'due_soon') return 'bg-amber-200 text-amber-950';
  if (bucket === 'on_time') return 'bg-emerald-200 text-emerald-950';
  return 'bg-stone-200 text-stone-800';
}
