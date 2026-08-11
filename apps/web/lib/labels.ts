import type { AppLocale } from '@/i18n/request';

export const REPORT_STATUSES = [
  'PENDING',
  'IN_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
] as const;

export type ReportStatusKey = (typeof REPORT_STATUSES)[number];

export const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ReportPriorityKey = (typeof REPORT_PRIORITIES)[number];

const STATUS_LABELS: Record<AppLocale, Record<ReportStatusKey, string>> = {
  sq: {
    PENDING: 'Në pritje',
    IN_REVIEW: 'Në shqyrtim',
    ASSIGNED: 'I caktuar',
    IN_PROGRESS: 'Në progres',
    RESOLVED: 'I zgjidhur',
    REJECTED: 'I refuzuar',
  },
  en: {
    PENDING: 'Pending',
    IN_REVIEW: 'Under review',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
  },
};

const PRIORITY_LABELS: Record<AppLocale, Record<ReportPriorityKey, string>> = {
  sq: {
    LOW: 'E ulët',
    MEDIUM: 'Mesatare',
    HIGH: 'E lartë',
    CRITICAL: 'Kritike',
  },
  en: {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
  },
};

const SLA_LABELS: Record<AppLocale, Record<'overdue' | 'due_soon' | 'on_time', string>> = {
  sq: {
    overdue: 'Vonuar',
    due_soon: 'Afati afër',
    on_time: 'Në kohë',
  },
  en: {
    overdue: 'Overdue',
    due_soon: 'Due soon',
    on_time: 'On time',
  },
};

export function getStatusLabel(status: string, locale: AppLocale = 'sq'): string {
  const map = STATUS_LABELS[locale] ?? STATUS_LABELS.sq;
  return map[status as ReportStatusKey] ?? status;
}

export function getPriorityLabel(priority: string, locale: AppLocale = 'sq'): string {
  const map = PRIORITY_LABELS[locale] ?? PRIORITY_LABELS.sq;
  return map[priority as ReportPriorityKey] ?? priority;
}

export function getSlaLabel(
  bucket: 'overdue' | 'due_soon' | 'on_time' | null,
  locale: AppLocale = 'sq',
): string {
  if (!bucket) return '—';
  return (SLA_LABELS[locale] ?? SLA_LABELS.sq)[bucket];
}

export const USER_ROLES = [
  'CITIZEN',
  'DEPARTMENT_STAFF',
  'DEPARTMENT_ADMIN',
  'SUPER_ADMIN',
] as const;

export type UserRoleKey = (typeof USER_ROLES)[number];

const ROLE_LABELS: Record<AppLocale, Record<UserRoleKey, string>> = {
  sq: {
    CITIZEN: 'Qytetar',
    DEPARTMENT_STAFF: 'Staf departamenti',
    DEPARTMENT_ADMIN: 'Admin departamenti',
    SUPER_ADMIN: 'Super admin',
  },
  en: {
    CITIZEN: 'Citizen',
    DEPARTMENT_STAFF: 'Department staff',
    DEPARTMENT_ADMIN: 'Department admin',
    SUPER_ADMIN: 'Super admin',
  },
};

export function getRoleLabel(role: string, locale: AppLocale = 'sq'): string {
  const map = ROLE_LABELS[locale] ?? ROLE_LABELS.sq;
  return map[role as UserRoleKey] ?? role;
}
