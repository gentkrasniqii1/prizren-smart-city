import { REPORT_STATUSES, type ReportStatus } from '@prizren/shared-types';
import type { AppLocale } from '@/i18n/request';

export { REPORT_STATUSES };
export type ReportStatusKey = ReportStatus;

export const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ReportPriorityKey = (typeof REPORT_PRIORITIES)[number];

const STATUS_LABELS: Record<AppLocale, Record<ReportStatusKey, string>> = {
  sq: {
    SUBMITTED: 'Dërguar',
    RECEIVED: 'I pranuar',
    UNDER_REVIEW: 'Në shqyrtim',
    ASSIGNED: 'Në radhë',
    IN_PROGRESS: 'Në hetim',
    WAITING_FOR_INFORMATION: 'Në pritje të informacionit',
    RESOLVED: 'I zgjidhur',
    REJECTED: 'I refuzuar',
    DUPLICATE: 'Duplikat',
  },
  en: {
    SUBMITTED: 'Submitted',
    RECEIVED: 'Received',
    UNDER_REVIEW: 'Under review',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    WAITING_FOR_INFORMATION: 'Waiting for information',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
    DUPLICATE: 'Duplicate',
  },
};

const PRIORITY_LABELS: Record<AppLocale, Record<ReportPriorityKey, string>> = {
  sq: {
    LOW: 'E ulët',
    MEDIUM: 'E mesme',
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

export const AI_CATEGORIES = [
  'road_damage',
  'lighting',
  'waste',
  'water',
  'public_space',
  'other',
] as const;

export type AiCategoryKey = (typeof AI_CATEGORIES)[number];

export const AI_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type AiSeverityKey = (typeof AI_SEVERITIES)[number];

const AI_CATEGORY_LABELS: Record<AppLocale, Record<AiCategoryKey, string>> = {
  sq: {
    road_damage: 'Grope / dëmtim rruge',
    lighting: 'Ndriçim publik i prishur',
    waste: 'Grumbullim mbeturinash / konteiner',
    water: 'Ujë i pijshëm (ndërprerje / cilësi)',
    public_space: 'Parke, pemë, hapësirë e gjelbër',
    other: 'Tjetër / e paklasifikuar',
  },
  en: {
    road_damage: 'Road damage',
    lighting: 'Lighting',
    waste: 'Waste',
    water: 'Water / sewage',
    public_space: 'Public space',
    other: 'Other',
  },
};

const AI_SEVERITY_LABELS: Record<AppLocale, Record<AiSeverityKey, string>> = {
  sq: {
    low: 'E ulët',
    medium: 'Mesatare',
    high: 'E lartë',
    critical: 'Kritike',
  },
  en: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  },
};

export function getAiCategoryLabel(category: string, locale: AppLocale = 'sq'): string {
  const map = AI_CATEGORY_LABELS[locale] ?? AI_CATEGORY_LABELS.sq;
  return map[category as AiCategoryKey] ?? category.replace(/_/g, ' ');
}

export function getAiSeverityLabel(severity: string, locale: AppLocale = 'sq'): string {
  const map = AI_SEVERITY_LABELS[locale] ?? AI_SEVERITY_LABELS.sq;
  return map[severity as AiSeverityKey] ?? severity;
}
