import { Priority, ReportStatus } from '@prisma/client';

/** SLA windows from assignment time (Phase 7). */
const SLA_MS: Record<Priority, number> = {
  CRITICAL: 4 * 60 * 60 * 1000,
  HIGH: 24 * 60 * 60 * 1000,
  MEDIUM: 3 * 24 * 60 * 60 * 1000,
  LOW: 7 * 24 * 60 * 60 * 1000,
};

export const OPEN_REPORT_STATUSES: ReportStatus[] = [
  ReportStatus.SUBMITTED,
  ReportStatus.UNDER_REVIEW,
  ReportStatus.ASSIGNED,
  ReportStatus.RECEIVED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.WAITING_FOR_INFORMATION,
];

/** Reports due within this window count as "due soon". */
export const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export function computeDueAt(priority: Priority | null | undefined, from = new Date()): Date {
  const ms = SLA_MS[priority ?? Priority.MEDIUM];
  return new Date(from.getTime() + ms);
}

export function computeDueAtFromHours(hours: number, from = new Date()): Date {
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 48;
  return new Date(from.getTime() + safe * 60 * 60 * 1000);
}

export type SlaBucket = 'overdue' | 'due_soon' | 'on_time';

export function slaBucket(
  dueAt: Date | string | null | undefined,
  now = new Date(),
): SlaBucket | null {
  if (!dueAt) return null;
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  if (Number.isNaN(due.getTime())) return null;
  const t = due.getTime();
  const n = now.getTime();
  if (t < n) return 'overdue';
  if (t <= n + DUE_SOON_MS) return 'due_soon';
  return 'on_time';
}
