export const REPORT_STATUSES = [
  'SUBMITTED',
  'RECEIVED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
  'RESOLVED',
  'REJECTED',
  'DUPLICATE',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
