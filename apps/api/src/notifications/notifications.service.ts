import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '../auth/config.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent(REPORT_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: StatusChangedEvent) {
    if (event.ownerUserId === event.changedByUserId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: event.ownerUserId,
        reportId: event.reportId,
        type: 'STATUS_CHANGED',
        channel: 'IN_APP',
        read: false,
      },
    });

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

  async listForUser(userId: string, opts: { unreadOnly?: boolean; page?: number; limit?: number }) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 50) : 20;
    const where = {
      userId,
      channel: 'IN_APP',
      ...(opts.unreadOnly ? { read: false } : {}),
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
        message:
          n.type === 'STATUS_CHANGED'
            ? 'Statusi i raportit tënd u përditësua.'
            : n.type === 'REPORT_RECEIVED'
              ? 'Raporti juaj u pranua.'
              : n.type === 'REPORT_ASSIGNED'
                ? 'Raporti juaj është caktuar për shqyrtim.'
                : n.type === 'REPORT_IN_PROGRESS'
                  ? 'Raporti juaj është në trajtim.'
                  : n.type === 'REPORT_RESOLVED'
                    ? 'Raporti juaj u zgjidh.'
                    : n.type === 'INFO_REQUESTED'
                      ? 'Administratori juaj ka kërkuar informacion shtesë.'
                      : n.type,
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
}
