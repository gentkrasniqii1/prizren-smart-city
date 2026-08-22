export const REPORT_MEDIA_ROLES = ['INITIAL', 'AFTER', 'ATTACHMENT'] as const;
export type ReportMediaRole = (typeof REPORT_MEDIA_ROLES)[number];

export const REPORT_MEDIA_VISIBILITIES = ['PUBLIC', 'STAFF'] as const;
export type ReportMediaVisibility = (typeof REPORT_MEDIA_VISIBILITIES)[number];

export const MAX_REPORT_PHOTOS = 5;

export interface ReportMediaDto {
  id: string;
  role: ReportMediaRole;
  sortOrder: number;
  url: string;
  mimeType: string | null;
  visibility: ReportMediaVisibility;
  createdAt: string;
}
