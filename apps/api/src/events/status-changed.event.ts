import { ReportStatus } from '@prisma/client';

export const REPORT_STATUS_CHANGED_EVENT = 'report.status_changed';
export const REPORT_CREATED_EVENT = 'report.created';

export class StatusChangedEvent {
  constructor(
    public readonly reportId: string,
    public readonly ownerUserId: string,
    public readonly oldStatus: ReportStatus,
    public readonly newStatus: ReportStatus,
    public readonly changedByUserId: string,
    public readonly note?: string,
  ) {}
}

export class ReportCreatedEvent {
  constructor(
    public readonly reportId: string,
    public readonly ownerUserId: string,
  ) {}
}
