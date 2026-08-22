import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OutboundEmailPurpose,
  OutboundEmailStatus,
  Prisma,
  ReportStatus,
  Role,
} from '@prisma/client';
import type { OutboundEmailDto, PaginatedOutboundEmails } from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ConfigService } from '../auth/config.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_ROLES } from '../reports/visibility';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';
import { InstitutionAccessService } from '../institution-access/institution-access.service';
import { evaluateInstitutionalMailPolicy } from './outbound-policy';
import { ListOutboundEmailQueryDto } from './dto/list-outbound-email-query.dto';

const PURPOSE = OutboundEmailPurpose.INSTITUTION_NEW_CASE;
const RETRYABLE: OutboundEmailStatus[] = [
  OutboundEmailStatus.NOT_CONFIGURED,
  OutboundEmailStatus.QUEUED,
  OutboundEmailStatus.FAILED,
  OutboundEmailStatus.RETRYING,
  OutboundEmailStatus.PERMANENTLY_FAILED,
];

const OUTBOUND_INCLUDE = {
  report: { select: { publicId: true } },
  institution: { select: { name: true } },
  accessToken: { select: { id: true, expiresAt: true, revokedAt: true } },
} satisfies Prisma.OutboundEmailInclude;

@Injectable()
export class OutboundEmailService {
  private readonly logger = new Logger(OutboundEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly access: InstitutionAccessService,
  ) {}

  @OnEvent(REPORT_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: StatusChangedEvent) {
    if (event.newStatus !== ReportStatus.ASSIGNED) return;
    if (
      event.oldStatus !== ReportStatus.SUBMITTED &&
      event.oldStatus !== ReportStatus.UNDER_REVIEW
    ) {
      return;
    }
    try {
      await this.enqueueInstitutionNewCase(event.reportId, event.changedByUserId);
    } catch (err) {
      this.logger.error(`Failed to enqueue institutional mail for report ${event.reportId}`);
    }
  }

  async enqueueInstitutionNewCase(
    reportId: string,
    actorUserId: string,
  ): Promise<OutboundEmailDto> {
    const existing = await this.prisma.outboundEmail.findUnique({
      where: { reportId_purpose: { reportId, purpose: PURPOSE } },
      include: OUTBOUND_INCLUDE,
    });
    if (existing) {
      return this.toDto(existing);
    }

    const report = await this.loadReport(reportId);
    const decision = this.decide(report.institution);
    const subject = `Raport i ri ${report.publicId} — Prizren Smart City`;

    let created;
    try {
      created = await this.prisma.outboundEmail.create({
        data: {
          reportId,
          institutionId: report.institutionId,
          purpose: PURPOSE,
          recipient: decision.send ? decision.recipient : (report.institution?.contact ?? null),
          subject,
          status: decision.send ? OutboundEmailStatus.QUEUED : OutboundEmailStatus.NOT_CONFIGURED,
          skipReason: decision.send ? null : decision.skipReason,
        },
        include: OUTBOUND_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.outboundEmail.findUnique({
          where: { reportId_purpose: { reportId, purpose: PURPOSE } },
          include: OUTBOUND_INCLUDE,
        });
        if (raced) return this.toDto(raced);
      }
      throw err;
    }

    await this.audit.log({
      userId: actorUserId,
      action: 'outbound_email.enqueue',
      entityType: 'OutboundEmail',
      entityId: created.id,
      metadata: {
        reportId,
        status: created.status,
        skipReason: created.skipReason,
      },
    });

    if (decision.send) {
      return this.attemptSend(created.id, actorUserId);
    }
    return this.toDto(created);
  }

  async list(user: AuthUser, query: ListOutboundEmailQueryDto): Promise<PaginatedOutboundEmails> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can view the mail ledger');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const scope = await this.staffScope(user);
    const where: Prisma.OutboundEmailWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.outboundEmail.count({ where }),
      this.prisma.outboundEmail.findMany({
        where,
        include: OUTBOUND_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        enabled: this.config.institutionalMailEnabled,
      },
    };
  }

  async retry(id: string, user: AuthUser): Promise<OutboundEmailDto> {
    if (user.role !== Role.DEPARTMENT_ADMIN && user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only department admin or super admin can retry outbound mail');
    }

    const existing = await this.prisma.outboundEmail.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Outbound email not found');
    }
    if (!RETRYABLE.includes(existing.status)) {
      throw new BadRequestException(`Cannot retry a message that is ${existing.status}`);
    }

    await this.audit.log({
      userId: user.id,
      action: 'outbound_email.retry',
      entityType: 'OutboundEmail',
      entityId: id,
      metadata: { previousStatus: existing.status },
    });

    return this.attemptSend(id, user.id);
  }

  private async attemptSend(id: string, actorUserId: string): Promise<OutboundEmailDto> {
    const row = await this.prisma.outboundEmail.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Outbound email not found');
    }

    const report = await this.loadReport(row.reportId);
    const decision = this.decide(report.institution);
    if (!decision.send || !report.institutionId) {
      const skipped = await this.prisma.outboundEmail.update({
        where: { id },
        data: {
          status: OutboundEmailStatus.NOT_CONFIGURED,
          skipReason: decision.send ? 'NO_INSTITUTION' : decision.skipReason,
          recipient: report.institution?.contact ?? null,
          institutionId: report.institutionId,
          lastError: decision.send ? 'NO_INSTITUTION' : decision.skipReason,
        },
        include: OUTBOUND_INCLUDE,
      });
      return this.toDto(skipped);
    }

    const sending = await this.prisma.outboundEmail.update({
      where: { id },
      data: {
        status: OutboundEmailStatus.SENDING,
        skipReason: null,
        recipient: decision.recipient,
        institutionId: report.institutionId,
        lastError: null,
      },
    });

    const token = await this.access.issue({
      reportId: report.id,
      institutionId: report.institutionId,
      actorUserId,
    });

    try {
      const result = await this.mail.sendInstitutionalNewCase({
        to: decision.recipient,
        publicId: report.publicId,
        description: report.description,
        categoryName: report.category?.name ?? null,
        priority: report.priority,
        address: report.address,
        lat: report.lat,
        lng: report.lng,
        createdAt: report.createdAt,
        dueAt: report.dueAt,
        photoUrl: report.photoUrl,
        reportUrl: `${this.config.webOrigin}/institution/reports/${token.raw}`,
        institutionName: report.institution?.name ?? null,
      });

      const sent = await this.prisma.outboundEmail.update({
        where: { id },
        data: {
          status: OutboundEmailStatus.SENT,
          provider: result.provider,
          providerMessageId: result.messageId ?? null,
          attemptCount: sending.attemptCount + 1,
          sentAt: new Date(),
          failedAt: null,
          nextRetryAt: null,
          lastError: null,
          accessTokenId: token.id,
        },
        include: OUTBOUND_INCLUDE,
      });
      await this.audit.log({
        userId: actorUserId,
        action: 'outbound_email.sent',
        entityType: 'OutboundEmail',
        entityId: id,
        metadata: { provider: result.provider },
      });
      return this.toDto(sent);
    } catch (err) {
      await this.access.revokeQuiet(token.id);
      const attemptCount = sending.attemptCount + 1;
      const permanent = attemptCount >= sending.maxAttempts;
      const message = err instanceof Error ? err.message : String(err);
      const failed = await this.prisma.outboundEmail.update({
        where: { id },
        data: {
          status: permanent ? OutboundEmailStatus.PERMANENTLY_FAILED : OutboundEmailStatus.FAILED,
          attemptCount,
          lastError: message.slice(0, 500),
          failedAt: new Date(),
          nextRetryAt: permanent ? null : this.backoff(attemptCount),
        },
        include: OUTBOUND_INCLUDE,
      });
      this.logger.error(
        JSON.stringify({
          event: 'outbound_email.failed',
          outboundEmailId: id,
          attemptCount,
          permanent,
        }),
      );
      await this.audit.log({
        userId: actorUserId,
        action: 'outbound_email.failed',
        entityType: 'OutboundEmail',
        entityId: id,
        metadata: {
          status: failed.status,
          attemptCount,
          permanent,
        },
      });
      return this.toDto(failed);
    }
  }

  private decide(
    institution: {
      contact: string | null;
      integrationType: string;
      integrationStatus: string;
    } | null,
  ) {
    return evaluateInstitutionalMailPolicy({
      enabled: this.config.institutionalMailEnabled,
      providerConfigured: this.mail.configured,
      institution,
    });
  }

  private async loadReport(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        institution: true,
        category: { select: { name: true } },
      },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  private async staffScope(user: AuthUser): Promise<Prisma.OutboundEmailWhereInput> {
    if (user.role === Role.SUPER_ADMIN) {
      return {};
    }
    const membership = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { departments: { select: { institutionId: true } } },
    });
    const institutionIds = (membership?.departments ?? [])
      .map((d) => d.institutionId)
      .filter((id): id is string => Boolean(id));
    if (institutionIds.length === 0) {
      return { id: { in: [] } };
    }
    return { institutionId: { in: institutionIds } };
  }

  private backoff(attemptCount: number): Date {
    return new Date(Date.now() + 2 ** attemptCount * 60_000);
  }

  private toDto(
    row: Prisma.OutboundEmailGetPayload<{ include: typeof OUTBOUND_INCLUDE }>,
  ): OutboundEmailDto {
    return {
      id: row.id,
      reportId: row.reportId,
      publicId: row.report.publicId,
      institutionId: row.institutionId,
      institutionName: row.institution?.name ?? null,
      purpose: row.purpose,
      recipient: row.recipient,
      subject: row.subject,
      provider: row.provider,
      providerMessageId: row.providerMessageId,
      status: row.status,
      skipReason: row.skipReason,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      lastError: row.lastError,
      queuedAt: row.queuedAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      failedAt: row.failedAt?.toISOString() ?? null,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      accessTokenId: row.accessToken?.id ?? row.accessTokenId,
      accessTokenExpiresAt: row.accessToken?.expiresAt.toISOString() ?? null,
      accessTokenRevokedAt: row.accessToken?.revokedAt?.toISOString() ?? null,
    };
  }
}
