import { ReportStatus } from '@prisma/client';

export const REPORT_STATUS_CHANGED_EVENT = 'report.status_changed';

export class StatusChangedEvent {
  constructor(
    public readonly reportId: string,
    public readonly ownerUserId: string,
    public readonly oldStatus: ReportStatus,
    public readonly newStatus: ReportStatus,
    public readonly changedByUserId: string,
  ) {}
}
