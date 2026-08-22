import { ReportStatus, Role } from '@prisma/client';
import { PUBLIC_REPORT_STATUSES } from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';

export const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

export function isStaffUser(user: AuthUser | null | undefined): boolean {
  return Boolean(user && STAFF_ROLES.includes(user.role as Role));
}

export function isPublicReportStatus(status: ReportStatus): boolean {
  return (PUBLIC_REPORT_STATUSES as ReportStatus[]).includes(status);
}

export function viewerCanAccessReport(
  report: { status: ReportStatus; userId: string },
  viewer: AuthUser | null,
): boolean {
  if (isPublicReportStatus(report.status)) return true;
  if (!viewer) return false;
  if (viewer.id === report.userId) return true;
  return isStaffUser(viewer);
}

/** Logged-in citizens may comment on official cases; owners/staff may comment while it is still in review. */
export function canCommentOnReport(
  report: { status: ReportStatus; userId: string },
  viewer: AuthUser | null,
): boolean {
  if (!viewer) return false;
  if (isStaffUser(viewer)) return true;
  if (viewer.id === report.userId) return true;
  return isPublicReportStatus(report.status);
}

/** Public viewers only see official-case transitions, never moderation internals. */
export function publicStatusHistory<T extends { newStatus: ReportStatus }>(
  history: T[],
  reportStatus: ReportStatus,
): T[] {
  if (!isPublicReportStatus(reportStatus)) {
    return history;
  }
  return history.filter((row) => isPublicReportStatus(row.newStatus));
}
