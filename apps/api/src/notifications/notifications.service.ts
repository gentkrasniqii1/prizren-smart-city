import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(REPORT_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: StatusChangedEvent) {
    if (event.ownerUserId === event.changedByUserId) {
      return;
    }

    const message = `Statusi i raportit u ndryshua: ${event.oldStatus} → ${event.newStatus}`;

    await this.prisma.notification.create({
      data: {
        userId: event.ownerUserId,
        reportId: event.reportId,
        type: 'STATUS_CHANGED',
        channel: 'IN_APP',
        read: false,
      },
    });

    // Email channel stub until SMTP is configured (Phase 8)
    this.logger.log(
      `[email-stub] To user ${event.ownerUserId}: ${message} (report ${event.reportId})`,
    );
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
        message: n.type === 'STATUS_CHANGED' ? 'Statusi i raportit tënd u përditësua.' : n.type,
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
