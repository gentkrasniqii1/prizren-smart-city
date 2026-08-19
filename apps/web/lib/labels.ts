import type { AppLocale } from '@/i18n/request';

export const REPORT_STATUSES = [
  'PENDING',
  'IN_REVIEW',
  'ASSIGNED',
  'ACCEPTED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
  'RESOLVED',
  'REJECTED',
  'DUPLICATE',
] as const;

export type ReportStatusKey = (typeof REPORT_STATUSES)[number];

export const REPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ReportPriorityKey = (typeof REPORT_PRIORITIES)[number];

const STATUS_LABELS: Record<AppLocale, Record<ReportStatusKey, string>> = {
  sq: {
    PENDING: 'Në pritje',
    IN_REVIEW: 'Në shqyrtim',
    ASSIGNED: 'Në radhë',
    ACCEPTED: 'I pranuar',
    IN_PROGRESS: 'Në hetim',
    WAITING_FOR_INFORMATION: 'Në pritje të informacionit',
    RESOLVED: 'I zgjidhur',
    REJECTED: 'I refuzuar',
    DUPLICATE: 'Duplikat',
  },
  en: {
    PENDING: 'Pending',
    IN_REVIEW: 'Under review',
    ASSIGNED: 'In queue',
    ACCEPTED: 'Accepted',
    IN_PROGRESS: 'Investigating',
    WAITING_FOR_INFORMATION: 'Waiting for information',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
    DUPLICATE: 'Duplicate',
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
    road_damage: 'Dëmtim rruge',
    lighting: 'Ndriçim',
    waste: 'Mbeturina',
    water: 'Ujë / kanalizim',
    public_space: 'Hapësirë publike',
    other: 'Tjetër',
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
