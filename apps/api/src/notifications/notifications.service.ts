import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { ConfigService } from '../auth/config.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedEvent,
  REPORT_CREATED_EVENT,
  REPORT_STATUS_CHANGED_EVENT,
  ReportCreatedEvent,
  StatusChangedEvent,
} from '../events/status-changed.event';
import { notificationTypeForStatus } from '@prizren/shared-types';

const IN_APP_MESSAGE_SQ: Record<string, string> = {
  REPORT_RECEIVED: 'Raporti juaj u pranua.',
  REPORT_ASSIGNED: 'Raporti juaj është caktuar për shqyrtim.',
  REPORT_ACCEPTED: 'Raporti juaj u pranua.',
  REPORT_IN_PROGRESS: 'Raporti juaj është në trajtim.',
  REPORT_IN_REVIEW: 'Raporti juaj është caktuar për shqyrtim.',
  REPORT_RESOLVED: 'Raporti juaj u zgjidh.',
  REPORT_REJECTED: 'Raporti juaj u refuzua.',
  REPORT_DUPLICATE: 'Raporti juaj u shënua si duplikat.',
  INFO_REQUESTED: 'Administratori juaj ka kërkuar informacion shtesë.',
  INSTITUTION_NEW_REPORT: 'Një raport i ri hyri në radhën tuaj.',
  STATUS_CHANGED: 'Statusi i raportit tuaj u përditësua.',
};

export type NotificationReadFilter = 'all' | 'unread' | 'read';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(REPORT_CREATED_EVENT)
  async handleReportCreated(event: ReportCreatedEvent) {
    await this.createInApp(event.ownerUserId, event.reportId, 'REPORT_RECEIVED');
    // In-app only for staff on the assigned department.
    // Institutional mail goes through OutboundEmailService, never this path.
    await this.notifyInstitutionStaff(event.reportId, event.ownerUserId);
  }

  @OnEvent(REPORT_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: StatusChangedEvent) {
    await this.createInApp(
      event.ownerUserId,
      event.reportId,
      notificationTypeForStatus(event.newStatus),
    );

    const owner = await this.prisma.user.findUnique({
      where: { id: event.ownerUserId },
      select: { email: true },
    });
    if (owner) {
      try {
        await this.mail.sendReportStatusChangedEmail(owner.email, {
          oldStatus: event.oldStatus,
          newStatus: event.newStatus,
          reportUrl: `${this.config.webOrigin}/reports/${event.reportId}`,
          note: event.note,
        });
      } catch (err) {
        this.logger.error(
          `Failed to send status-changed email for report ${event.reportId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }
  }

  async listForUser(
    userId: string,
    opts: {
      read?: NotificationReadFilter;
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 50) : 20;
    const readFilter: NotificationReadFilter = opts.unreadOnly
      ? 'unread'
      : opts.read === 'unread' || opts.read === 'read'
        ? opts.read
        : 'all';
    const where = {
      userId,
      channel: 'IN_APP',
      ...(readFilter === 'unread' ? { read: false } : {}),
      ...(readFilter === 'read' ? { read: true } : {}),
    };

    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, channel: 'IN_APP', read: false },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((n) => ({
        id: n.id,
        reportId: n.reportId,
        type: n.type,
        channel: n.channel,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        message: IN_APP_MESSAGE_SQ[n.type] ?? n.type,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        unreadCount,
      },
    };
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return null;
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return {
      id: updated.id,
      reportId: updated.reportId,
      type: updated.type,
      channel: updated.channel,
      read: updated.read,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false, channel: 'IN_APP' },
      data: { read: true },
    });
    return { updated: result.count };
  }

  private async createInApp(userId: string, reportId: string | null, type: string) {
    await this.prisma.notification.create({
      data: {
        userId,
        reportId,
        type,
        channel: 'IN_APP',
        read: false,
      },
    });
    this.events.emit(NOTIFICATION_CREATED_EVENT, new NotificationCreatedEvent(userId, reportId));
  }

  private async notifyInstitutionStaff(reportId: string, ownerUserId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { departmentId: true, institutionId: true },
    });
    if (!report?.departmentId && !report?.institutionId) return;

    const staff = await this.prisma.user.findMany({
      where: {
        id: { not: ownerUserId },
        role: { in: [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN] },
        departments: {
          some: {
            OR: [
              ...(report.departmentId ? [{ id: report.departmentId }] : []),
              ...(report.institutionId ? [{ institutionId: report.institutionId }] : []),
            ],
          },
        },
      },
      select: { id: true },
    });

    for (const user of staff) {
      await this.createInApp(user.id, reportId, 'INSTITUTION_NEW_REPORT');
    }
  }
}
