import type { Role } from '@prisma/client';
import type { RealtimeEvent } from '@prizren/shared-types';

export type RealtimeAudience = {
  userId: string;
  role: Role;
  departmentIds: string[];
  institutionIds: string[];
};

/**
 * Who may receive a live event. Citizens only see their own reports and
 * notifications. Staff see reports in their department/institution. Super
 * admins see every report event; notification events stay recipient-only.
 */
export function realtimeEventVisibleTo(audience: RealtimeAudience, event: RealtimeEvent): boolean {
  if (event.type === 'user.avatar.updated') {
    return true;
  }
  if (event.type === 'notification.created') {
    return event.notificationUserId === audience.userId;
  }
  if (audience.role === 'SUPER_ADMIN') {
    return true;
  }
  if (event.ownerUserId === audience.userId) {
    return true;
  }
  if (audience.role === 'CITIZEN') {
    return false;
  }
  if (event.departmentId && audience.departmentIds.includes(event.departmentId)) {
    return true;
  }
  if (event.institutionId && audience.institutionIds.includes(event.institutionId)) {
    return true;
  }
  return false;
}
