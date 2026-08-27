import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import { Role } from '@prisma/client';
import type { RealtimeEvent } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedEvent,
  REPORT_CREATED_EVENT,
  REPORT_STATUS_CHANGED_EVENT,
  ReportCreatedEvent,
  StatusChangedEvent,
  USER_AVATAR_UPDATED_EVENT,
  UserAvatarUpdatedEvent,
} from '../events/status-changed.event';
import { realtimeEventVisibleTo, type RealtimeAudience } from './realtime-audience';

const BUS_EVENT = 'realtime';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly bus = new EventEmitter();

  constructor(private readonly prisma: PrismaService) {
    this.bus.setMaxListeners(0);
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.bus.on(BUS_EVENT, listener);
    return () => {
      this.bus.off(BUS_EVENT, listener);
    };
  }

  visibleTo(audience: RealtimeAudience, event: RealtimeEvent): boolean {
    return realtimeEventVisibleTo(audience, event);
  }

  async loadAudience(user: AuthUser): Promise<RealtimeAudience> {
    if (user.role === Role.CITIZEN || user.role === Role.SUPER_ADMIN) {
      return {
        userId: user.id,
        role: user.role as Role,
        departmentIds: [],
        institutionIds: [],
      };
    }

    const membership = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { departments: { select: { id: true, institutionId: true } } },
    });
    const departments = membership?.departments ?? [];
    return {
      userId: user.id,
      role: user.role as Role,
      departmentIds: departments.map((d) => d.id),
      institutionIds: departments
        .map((d) => d.institutionId)
        .filter((id): id is string => Boolean(id)),
    };
  }

  @OnEvent(REPORT_CREATED_EVENT)
  async handleReportCreated(event: ReportCreatedEvent) {
    await this.publishReport('report.created', event.reportId);
  }

  @OnEvent(REPORT_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: StatusChangedEvent) {
    await this.publishReport('report.updated', event.reportId);
  }

  @OnEvent(NOTIFICATION_CREATED_EVENT)
  handleNotificationCreated(event: NotificationCreatedEvent) {
    this.publish({
      type: 'notification.created',
      at: new Date().toISOString(),
      reportId: event.reportId ?? undefined,
      notificationUserId: event.userId,
    });
  }

  @OnEvent(USER_AVATAR_UPDATED_EVENT)
  handleAvatarUpdated(event: UserAvatarUpdatedEvent) {
    this.publish({
      type: 'user.avatar.updated',
      at: new Date().toISOString(),
      userId: event.userId,
      avatarUrl: event.avatarUrl,
    });
  }

  private async publishReport(type: 'report.created' | 'report.updated', reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, userId: true, institutionId: true, departmentId: true },
    });
    if (!report) {
      this.logger.warn(`Realtime skip ${type}: report ${reportId} missing`);
      return;
    }
    this.publish({
      type,
      at: new Date().toISOString(),
      reportId: report.id,
      ownerUserId: report.userId,
      institutionId: report.institutionId,
      departmentId: report.departmentId,
    });
  }

  private publish(event: RealtimeEvent) {
    this.bus.emit(BUS_EVENT, event);
  }
}
