export const REALTIME_EVENT_TYPES = [
  'report.created',
  'report.updated',
  'notification.created',
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

/** Payload pushed over GET /realtime/stream (SSE). */
export interface RealtimeEvent {
  type: RealtimeEventType;
  at: string;
  reportId?: string;
  ownerUserId?: string;
  institutionId?: string | null;
  departmentId?: string | null;
  notificationUserId?: string;
}
