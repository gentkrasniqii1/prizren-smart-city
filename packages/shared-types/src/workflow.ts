import type { ReportStatus } from './report-status';

export type WorkflowAction =
  'accept' | 'investigate' | 'request_info' | 'resolve' | 'reject' | 'mark_duplicate';

/** Staff decisions before a report becomes an official civic case. */
export type ModerationAction =
  | 'approve'
  | 'start_review'
  | 'reject_spam'
  | 'reject_invalid'
  | 'mark_duplicate'
  | 'request_information';

export const MODERATION_ACTIONS = [
  'approve',
  'start_review',
  'reject_spam',
  'reject_invalid',
  'mark_duplicate',
  'request_information',
] as const satisfies readonly ModerationAction[];

export const MODERATION_ACTIONS_REQUIRING_NOTE: ModerationAction[] = [
  'reject_spam',
  'reject_invalid',
  'mark_duplicate',
  'request_information',
];

/** Visible on public lists, maps, nearby, and transparency. Owner + staff still see the rest. */
export const PUBLIC_REPORT_STATUSES: ReportStatus[] = [
  'ASSIGNED',
  'RECEIVED',
  'IN_PROGRESS',
  'WAITING_FOR_INFORMATION',
  'RESOLVED',
];

export const PRE_APPROVAL_STATUSES: ReportStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

export function isPublicReportStatus(status: ReportStatus): boolean {
  return PUBLIC_REPORT_STATUSES.includes(status);
}

export function allowedModerationActions(status: ReportStatus): ModerationAction[] {
  if (status === 'SUBMITTED') {
    return [
      'approve',
      'start_review',
      'reject_spam',
      'reject_invalid',
      'mark_duplicate',
      'request_information',
    ];
  }
  if (status === 'UNDER_REVIEW') {
    return ['approve', 'reject_spam', 'reject_invalid', 'mark_duplicate', 'request_information'];
  }
  return [];
}

export const WORKFLOW_ACTIONS = [
  'accept',
  'investigate',
  'request_info',
  'resolve',
  'reject',
  'mark_duplicate',
] as const satisfies readonly WorkflowAction[];

/** Happy-path civic pipeline shown to citizens. Side-states are omitted. */
export const CITIZEN_PIPELINE: ReportStatus[] = [
  'SUBMITTED',
  'ASSIGNED',
  'RECEIVED',
  'IN_PROGRESS',
  'RESOLVED',
];

/**
 * Legal next statuses for staff. SUPER_ADMIN may bypass this matrix.
 * Institution desk: ASSIGNED (queue) → RECEIVED → IN_PROGRESS → RESOLVED.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'ASSIGNED', 'REJECTED', 'DUPLICATE'],
  UNDER_REVIEW: ['ASSIGNED', 'SUBMITTED', 'REJECTED', 'DUPLICATE'],
  ASSIGNED: ['RECEIVED', 'UNDER_REVIEW', 'REJECTED', 'DUPLICATE'],
  RECEIVED: ['IN_PROGRESS', 'WAITING_FOR_INFORMATION', 'ASSIGNED', 'REJECTED'],
  IN_PROGRESS: ['WAITING_FOR_INFORMATION', 'RESOLVED', 'REJECTED', 'RECEIVED'],
  WAITING_FOR_INFORMATION: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
  DUPLICATE: [],
};

export const WORKFLOW_ACTION_TARGET: Record<WorkflowAction, ReportStatus> = {
  accept: 'RECEIVED',
  investigate: 'IN_PROGRESS',
  request_info: 'WAITING_FOR_INFORMATION',
  resolve: 'RESOLVED',
  reject: 'REJECTED',
  mark_duplicate: 'DUPLICATE',
};

export const WORKFLOW_ACTIONS_REQUIRING_NOTE: WorkflowAction[] = ['reject', 'mark_duplicate'];

export function canTransitionStatus(
  from: ReportStatus,
  to: ReportStatus,
  opts?: { bypass?: boolean },
): boolean {
  if (from === to) return false;
  if (opts?.bypass) return true;
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function allowedWorkflowActions(status: ReportStatus): WorkflowAction[] {
  return WORKFLOW_ACTIONS.filter((action) =>
    canTransitionStatus(status, WORKFLOW_ACTION_TARGET[action]),
  );
}

export type QueueLane = 'pending' | 'incoming' | 'active' | 'waiting' | 'done';

export const QUEUE_LANE_STATUSES: Record<QueueLane, ReportStatus[]> = {
  pending: ['SUBMITTED', 'UNDER_REVIEW'],
  incoming: ['ASSIGNED'],
  active: ['RECEIVED', 'IN_PROGRESS'],
  waiting: ['WAITING_FOR_INFORMATION'],
  done: ['RESOLVED', 'REJECTED', 'DUPLICATE'],
};

export function notificationTypeForStatus(status: ReportStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'REPORT_ASSIGNED';
    case 'RECEIVED':
      return 'REPORT_ACCEPTED';
    case 'IN_PROGRESS':
      return 'REPORT_IN_PROGRESS';
    case 'WAITING_FOR_INFORMATION':
      return 'INFO_REQUESTED';
    case 'RESOLVED':
      return 'REPORT_RESOLVED';
    case 'REJECTED':
      return 'REPORT_REJECTED';
    case 'DUPLICATE':
      return 'REPORT_DUPLICATE';
    case 'UNDER_REVIEW':
      return 'REPORT_IN_REVIEW';
    case 'SUBMITTED':
      return 'REPORT_RECEIVED';
    default:
      return 'STATUS_CHANGED';
  }
}
