import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Priority, Report, ReportStatus, Role } from '@prisma/client';
import type {
  AIClassification,
  CommentDto,
  MyReportStats,
  PaginatedComments,
  PaginatedReports,
  QueueLane,
  ReportDto,
  StatusHistoryDto,
  VoteCountResponse,
} from '@prizren/shared-types';
import {
  allowedWorkflowActions,
  canTransitionStatus,
  QUEUE_LANE_STATUSES,
  WORKFLOW_ACTION_TARGET,
  WORKFLOW_ACTIONS_REQUIRING_NOTE,
} from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ConfigService } from '../auth/config.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AiClassificationService } from '../ai/ai-classification.service';
import {
  AI_CATEGORY_TO_DB_NAME,
  AI_CONFIDENCE_THRESHOLD,
  AI_SEVERITY_TO_PRIORITY,
  parseAIClassification,
} from '../ai/ai-classification.schema';
import { CreateReportFields } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { UpdateAiClassificationDto } from './dto/update-ai-classification.dto';
import { AssignReportDto } from './dto/assign-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import {
  AddReportNoteDto,
  EscalateReportDto,
  UpdateReportPriorityDto,
} from './dto/update-report-priority.dto';
import { computeDueAt } from './sla';
import { nextReportPublicId } from './public-id';
import { WorkflowActionDto } from './dto/workflow-action.dto';
import {
  REPORT_CREATED_EVENT,
  REPORT_STATUS_CHANGED_EVENT,
  ReportCreatedEvent,
  StatusChangedEvent,
} from '../events/status-changed.event';
import { assertValidImageUpload } from '../uploads/image-validation';
import { RoutingService } from '../routing/routing.service';

const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];
const AI_ADMIN_ROLES: Role[] = [Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];
const OPEN_STATUSES: ReportStatus[] = [
  ReportStatus.PENDING,
  ReportStatus.IN_REVIEW,
  ReportStatus.ASSIGNED,
  ReportStatus.ACCEPTED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.WAITING_FOR_INFORMATION,
];
const SYSTEM_ACTOR = 'SYSTEM';

/** Shared `include` shape so every Report query returns display names consistently. */
const REPORT_INCLUDE = {
  category: { select: { name: true } },
  department: { select: { name: true } },
  institution: { select: { name: true } },
  _count: { select: { votes: true } },
} satisfies Prisma.ReportInclude;

const REPORT_DETAIL_INCLUDE = {
  ...REPORT_INCLUDE,
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.ReportInclude;

type ReportWithRelations = Report & {
  category?: { name: string } | null;
  department?: { name: string } | null;
  institution?: { name: string } | null;
  _count?: { votes: number };
  statusHistory?: Array<{
    id: string;
    oldStatus: ReportStatus;
    newStatus: ReportStatus;
    changedAt: Date;
    note: string | null;
  }>;
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly aiClassification: AiClassificationService,
    private readonly events: EventEmitter2,
    private readonly routing: RoutingService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(
    user: AuthUser,
    fields: CreateReportFields,
    file?: Express.Multer.File,
  ): Promise<ReportDto> {
    let photoUrl: string | undefined;
    if (file) {
      await assertValidImageUpload(file);
      const publicId = `report-${user.id}-${Date.now()}`;
      photoUrl = await this.cloudinary.uploadImage(file.buffer, publicId);
    }

    const routed = await this.routing.routeByCategory(fields.categoryId);

    const report = await this.prisma.$transaction(async (tx) => {
      const publicId = await nextReportPublicId(tx);
      return tx.report.create({
        data: {
          publicId,
          userId: user.id,
          description: fields.description,
          lat: fields.lat,
          lng: fields.lng,
          address: fields.address,
          categoryId: fields.categoryId,
          departmentId: routed?.departmentId,
          institutionId: routed?.institutionId ?? undefined,
          priority: routed?.defaultPriority ?? null,
          photoUrl,
          status: ReportStatus.PENDING,
        },
        include: REPORT_INCLUDE,
      });
    });

    await this.syncReportLocation(report.id, fields.lat, fields.lng);

    const classified = await this.applyAiClassificationAfterCreate(report.id, {
      photoUrl: photoUrl ?? null,
      description: fields.description,
      lat: fields.lat,
      lng: fields.lng,
      categoryId: fields.categoryId ?? null,
      currentStatus: report.status,
      departmentId: report.departmentId,
      institutionId: report.institutionId,
    });

    let result = classified ?? report;
    if (result.status === ReportStatus.PENDING && (result.departmentId || result.institutionId)) {
      result = await this.enterInstitutionQueue(result.id, SYSTEM_ACTOR);
    }

    this.events.emit(REPORT_CREATED_EVENT, new ReportCreatedEvent(result.id, user.id));

    try {
      await this.mail.sendReportReceivedEmail(user.email, {
        reportId: report.id,
        description: fields.description,
        reportUrl: `${this.config.webOrigin}/reports/${report.id}`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send report-received email for report ${report.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return this.toDto(result, {
      includeUserId: true,
      staff: STAFF_ROLES.includes(user.role as Role),
    });
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number,
    viewer: AuthUser | null,
  ): Promise<ReportDto[]> {
    const radiusMeters = radiusKm * 1000;

    type NearbyRow = {
      id: string;
      publicId: string;
      userId: string;
      categoryId: string | null;
      subcategory: string | null;
      departmentId: string | null;
      institutionId: string | null;
      description: string;
      status: ReportStatus;
      priority: Report['priority'];
      lat: number;
      lng: number;
      address: string | null;
      photoUrl: string | null;
      photoAfterUrl: string | null;
      aiClassification: Prisma.JsonValue | null;
      aiConfidence: number | null;
      duplicateOfId: string | null;
      isDuplicate: boolean;
      assignedStaffId: string | null;
      source: string;
      anonymous: boolean;
      language: string;
      dueAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      categoryName: string | null;
      departmentName: string | null;
      institutionName: string | null;
      voteCount: number;
    };

    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        r.id,
        r."publicId",
        r."userId",
        r."categoryId",
        r."subcategory",
        r."departmentId",
        r."institutionId",
        r.description,
        r.status,
        r.priority,
        r.lat,
        r.lng,
        r.address,
        r."photoUrl",
        r."photoAfterUrl",
        r."aiClassification",
        r."aiConfidence",
        r."duplicateOfId",
        r."isDuplicate",
        r."assignedStaffId",
        r.source,
        r.anonymous,
        r.language,
        r."dueAt",
        r."createdAt",
        r."updatedAt",
        c.name AS "categoryName",
        d.name AS "departmentName",
        i.name AS "institutionName",
        COALESCE(v.cnt, 0)::int AS "voteCount"
      FROM "Report" r
      LEFT JOIN "Category" c ON c.id = r."categoryId"
      LEFT JOIN "Department" d ON d.id = r."departmentId"
      LEFT JOIN "Institution" i ON i.id = r."institutionId"
      LEFT JOIN (
        SELECT "reportId", COUNT(*)::int AS cnt
        FROM "Vote"
        GROUP BY "reportId"
      ) v ON v."reportId" = r.id
      WHERE r.location IS NOT NULL
        AND ST_DWithin(
          r.location,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY ST_Distance(
        r.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) ASC
      LIMIT 200
    `;

    return rows.map((row) =>
      this.toDto(
        {
          ...row,
          category: row.categoryName ? { name: row.categoryName } : null,
          department: row.departmentName ? { name: row.departmentName } : null,
          institution: row.institutionName ? { name: row.institutionName } : null,
          _count: { votes: row.voteCount },
        },
        { includeUserId: this.canSeeUserId(viewer, row.userId) },
      ),
    );
  }

  private async syncReportLocation(id: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "Report"
      SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      WHERE id = ${id}
    `;
  }

  async list(query: ListReportsQueryDto, viewer: AuthUser | null): Promise<PaginatedReports> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) =>
        this.toDto(row, {
          includeUserId: this.canSeeUserId(viewer, row.userId),
          staff: Boolean(viewer && STAFF_ROLES.includes(viewer.role as Role)),
        }),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string, viewer: AuthUser | null): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: REPORT_DETAIL_INCLUDE,
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    let votedByMe: boolean | undefined;
    if (viewer) {
      const vote = await this.prisma.vote.findUnique({
        where: {
          reportId_userId: { reportId: id, userId: viewer.id },
        },
      });
      votedByMe = Boolean(vote);
    }

    return this.toDto(report, {
      includeUserId: this.canSeeUserId(viewer, report.userId),
      votedByMe,
      staff: Boolean(viewer && STAFF_ROLES.includes(viewer.role as Role)),
    });
  }

  async listMine(user: AuthUser, page = 1, limit = 20): Promise<PaginatedReports> {
    const where = { userId: user.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row, { includeUserId: true })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Full DB-side aggregate for the citizen dashboard's stat cards — unlike the
  // paginated `/reports/mine` list (capped for display), these counts must
  // reflect ALL of the user's reports, not just the current page.
  async myStats(userId: string): Promise<MyReportStats> {
    const [total, open, inProgress, resolved] = await Promise.all([
      this.prisma.report.count({ where: { userId } }),
      this.prisma.report.count({ where: { userId, status: { in: OPEN_STATUSES } } }),
      this.prisma.report.count({
        where: {
          userId,
          status: { in: [ReportStatus.ASSIGNED, ReportStatus.ACCEPTED, ReportStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.report.count({ where: { userId, status: ReportStatus.RESOLVED } }),
    ]);
    return { total, open, inProgress, resolved };
  }

  async updateStatus(
    id: string,
    user: AuthUser,
    dto: UpdateReportStatusDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can update status');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }
    if (existing.status === dto.status) {
      throw new BadRequestException('Status is already set to this value');
    }

    this.assertStatusTransition(existing.status, dto.status, user.role as Role);

    if (dto.status === ReportStatus.RESOLVED && !existing.photoAfterUrl) {
      throw new BadRequestException(
        'photoAfterUrl is required before resolving. Upload via POST /reports/:id/photo-after',
      );
    }

    const nextDueAt =
      (dto.status === ReportStatus.ASSIGNED || dto.status === ReportStatus.ACCEPTED) &&
      !existing.dueAt
        ? computeDueAt(existing.priority)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          status: dto.status,
          ...(nextDueAt ? { dueAt: nextDueAt } : {}),
        },
        include: REPORT_DETAIL_INCLUDE,
      });

      await tx.statusHistory.create({
        data: {
          reportId: id,
          oldStatus: existing.status,
          newStatus: dto.status,
          changedBy: user.id,
          note: dto.note?.trim() || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.status_update',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            oldStatus: existing.status,
            newStatus: dto.status,
            note: dto.note ?? null,
            dueAt: report.dueAt?.toISOString() ?? null,
          },
        },
      });

      return report;
    });

    this.events.emit(
      REPORT_STATUS_CHANGED_EVENT,
      new StatusChangedEvent(
        updated.id,
        existing.userId,
        existing.status,
        dto.status,
        user.id,
        dto.note,
      ),
    );

    return this.toDto(updated, { includeUserId: true, staff: true });
  }

  async applyWorkflowAction(
    id: string,
    user: AuthUser,
    dto: WorkflowActionDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can run the institution workflow');
    }

    const note = dto.note?.trim();
    if (WORKFLOW_ACTIONS_REQUIRING_NOTE.includes(dto.action) && !note) {
      throw new BadRequestException('note is required for this action');
    }

    return this.updateStatus(
      id,
      user,
      { status: WORKFLOW_ACTION_TARGET[dto.action] as ReportStatus, note },
      ipAddress,
    );
  }

  async listQueue(user: AuthUser, query: ListReportsQueryDto): Promise<PaginatedReports> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can open the institution queue');
    }

    const scope = await this.staffQueueScope(user);
    const lane: QueueLane = query.lane ?? 'incoming';
    const laneStatuses = QUEUE_LANE_STATUSES[lane] as ReportStatus[];

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReportWhereInput = {
      ...this.buildWhere(query),
      ...scope,
      status: query.status ?? { in: laneStatuses },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toDto(row, { includeUserId: true, staff: true })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async assign(
    id: string,
    user: AuthUser,
    dto: AssignReportDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!AI_ADMIN_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only department admin or super admin can assign reports');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    let departmentId = dto.departmentId === undefined ? existing.departmentId : dto.departmentId;
    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) {
        throw new BadRequestException('Invalid departmentId');
      }
    }

    let institutionId =
      dto.institutionId === undefined ? existing.institutionId : dto.institutionId;
    if (dto.institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: dto.institutionId },
      });
      if (!institution) {
        throw new BadRequestException('Invalid institutionId');
      }
    }

    if (dto.assignedStaffId) {
      const staff = await this.prisma.user.findUnique({ where: { id: dto.assignedStaffId } });
      if (!staff || !STAFF_ROLES.includes(staff.role)) {
        throw new BadRequestException('assignedStaffId must be a staff/admin user');
      }
    }

    const nextStatus =
      existing.status === ReportStatus.PENDING || existing.status === ReportStatus.IN_REVIEW
        ? ReportStatus.ASSIGNED
        : existing.status;

    const dueAt = existing.dueAt ?? computeDueAt(existing.priority);

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          departmentId: departmentId ?? null,
          institutionId: institutionId ?? null,
          assignedStaffId:
            dto.assignedStaffId === undefined ? existing.assignedStaffId : dto.assignedStaffId,
          status: nextStatus,
          dueAt,
        },
        include: REPORT_INCLUDE,
      });

      if (nextStatus !== existing.status) {
        await tx.statusHistory.create({
          data: {
            reportId: id,
            oldStatus: existing.status,
            newStatus: nextStatus,
            changedBy: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.assign',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: JSON.parse(
            JSON.stringify({
              departmentId: report.departmentId,
              institutionId: report.institutionId,
              assignedStaffId: report.assignedStaffId,
              status: report.status,
              dueAt: report.dueAt?.toISOString() ?? null,
            }),
          ) as Prisma.InputJsonValue,
        },
      });

      return report;
    });

    if (nextStatus !== existing.status) {
      this.events.emit(
        REPORT_STATUS_CHANGED_EVENT,
        new StatusChangedEvent(updated.id, existing.userId, existing.status, nextStatus, user.id),
      );
    }

    return this.toDto(updated, { includeUserId: true });
  }

  async updatePriority(
    id: string,
    user: AuthUser,
    dto: UpdateReportPriorityDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can set priority');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    const dueAt = OPEN_STATUSES.includes(existing.status)
      ? computeDueAt(dto.priority)
      : existing.dueAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { priority: dto.priority, dueAt },
        include: REPORT_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.priority_update',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            oldPriority: existing.priority,
            newPriority: dto.priority,
            note: dto.note ?? null,
            dueAt: report.dueAt?.toISOString() ?? null,
          },
        },
      });

      return report;
    });

    return this.toDto(updated, { includeUserId: true });
  }

  async escalate(
    id: string,
    user: AuthUser,
    dto: EscalateReportDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can escalate reports');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    const order: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];
    const currentIndex = existing.priority ? order.indexOf(existing.priority) : -1;
    const nextPriority =
      currentIndex < 0 ? Priority.HIGH : order[Math.min(currentIndex + 1, order.length - 1)];

    const nextStatus =
      existing.status === ReportStatus.PENDING ? ReportStatus.IN_REVIEW : existing.status;
    const dueAt = OPEN_STATUSES.includes(nextStatus) ? computeDueAt(nextPriority) : existing.dueAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { priority: nextPriority, status: nextStatus, dueAt },
        include: REPORT_INCLUDE,
      });

      if (nextStatus !== existing.status) {
        await tx.statusHistory.create({
          data: {
            reportId: id,
            oldStatus: existing.status,
            newStatus: nextStatus,
            changedBy: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.escalate',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            oldPriority: existing.priority,
            newPriority: nextPriority,
            oldStatus: existing.status,
            newStatus: nextStatus,
            note: dto.note ?? null,
          },
        },
      });

      return report;
    });

    if (nextStatus !== existing.status) {
      this.events.emit(
        REPORT_STATUS_CHANGED_EVENT,
        new StatusChangedEvent(
          updated.id,
          existing.userId,
          existing.status,
          nextStatus,
          user.id,
          dto.note,
        ),
      );
    }

    return this.toDto(updated, { includeUserId: true });
  }

  async addStaffNote(
    id: string,
    user: AuthUser,
    dto: AddReportNoteDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can add notes');
    }

    const note = dto.note.trim();
    if (!note) {
      throw new BadRequestException('note is required');
    }

    const existing = await this.prisma.report.findUnique({
      where: { id },
      include: REPORT_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'report.note',
        entityType: 'Report',
        entityId: id,
        ipAddress: ipAddress ?? undefined,
        metadata: { note },
      },
    });

    return this.toDto(existing, { includeUserId: true });
  }

  async uploadPhotoAfter(
    id: string,
    user: AuthUser,
    file: Express.Multer.File,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can upload after photos');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    await assertValidImageUpload(file);
    const publicId = `report-${id}-after-${Date.now()}`;
    const photoAfterUrl = await this.cloudinary.uploadImage(file.buffer, publicId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { photoAfterUrl },
        include: REPORT_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.photo_after_upload',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: { photoAfterUrl },
        },
      });

      return report;
    });

    return this.toDto(updated, { includeUserId: true });
  }

  async addVote(id: string, user: AuthUser): Promise<VoteCountResponse> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    try {
      await this.prisma.vote.create({
        data: { reportId: id, userId: user.id },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // already voted — idempotent
      } else {
        throw err;
      }
    }

    const voteCount = await this.prisma.vote.count({ where: { reportId: id } });
    return { voteCount, votedByMe: true };
  }

  async removeVote(id: string, user: AuthUser): Promise<VoteCountResponse> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.vote.deleteMany({
      where: { reportId: id, userId: user.id },
    });

    const voteCount = await this.prisma.vote.count({ where: { reportId: id } });
    return { voteCount, votedByMe: false };
  }

  async listComments(id: string, page = 1, limit = 20): Promise<PaginatedComments> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 50) : 20;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where: { reportId: id } }),
      this.prisma.comment.findMany({
        where: { reportId: id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toCommentDto(row)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async addComment(id: string, user: AuthUser, text: string): Promise<CommentDto> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('text is required');
    }

    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const created = await this.prisma.comment.create({
      data: {
        reportId: id,
        userId: user.id,
        text: trimmed,
      },
      include: { user: { select: { name: true } } },
    });

    return this.toCommentDto(created);
  }

  async updateAiClassification(
    id: string,
    user: AuthUser,
    dto: UpdateAiClassificationDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!AI_ADMIN_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException(
        'Only department admin or super admin can manage AI classification',
      );
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    let classification: AIClassification | null =
      parseAIClassification(existing.aiClassification) ??
      (existing.aiClassification as AIClassification | null);

    if (dto.action === 'edit') {
      const merged = {
        category: dto.category ?? classification?.category,
        severity: dto.severity ?? classification?.severity,
        confidence: dto.confidence ?? classification?.confidence ?? 1,
        summary: dto.summary ?? classification?.summary,
        recommendedDepartment: dto.recommendedDepartment ?? classification?.recommendedDepartment,
      };
      classification = parseAIClassification(merged);
      if (!classification) {
        throw new BadRequestException('Invalid AI classification payload for edit');
      }
    } else if (!classification) {
      throw new BadRequestException('No AI classification to accept');
    }

    const mapped = await this.resolveCategoryAndPriority(classification);
    const nextStatus =
      existing.status === ReportStatus.PENDING || existing.status === ReportStatus.IN_REVIEW
        ? mapped.departmentId || mapped.institutionId
          ? ReportStatus.ASSIGNED
          : ReportStatus.IN_REVIEW
        : existing.status;
    const dueAt =
      nextStatus === ReportStatus.ASSIGNED && !existing.dueAt
        ? computeDueAt(mapped.priority ?? existing.priority)
        : existing.dueAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          aiClassification: classification as unknown as Prisma.InputJsonValue,
          aiConfidence: classification.confidence,
          categoryId: mapped.categoryId ?? existing.categoryId,
          departmentId: mapped.departmentId ?? existing.departmentId,
          institutionId: mapped.institutionId ?? existing.institutionId,
          priority: mapped.priority ?? existing.priority,
          status: nextStatus,
          dueAt,
        },
        include: REPORT_INCLUDE,
      });

      if (nextStatus !== existing.status) {
        await tx.statusHistory.create({
          data: {
            reportId: id,
            oldStatus: existing.status,
            newStatus: nextStatus,
            changedBy: user.id,
            note: 'Kategoria u konfirmua — raporti hyri në radhën e institucionit',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action:
            dto.action === 'accept'
              ? 'report.ai_classification_accept'
              : 'report.ai_classification_edit',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: JSON.parse(JSON.stringify({ classification })) as Prisma.InputJsonValue,
        },
      });

      return report;
    });

    if (nextStatus !== existing.status) {
      this.events.emit(
        REPORT_STATUS_CHANGED_EVENT,
        new StatusChangedEvent(updated.id, existing.userId, existing.status, nextStatus, user.id),
      );
    }

    return this.toDto(updated, { includeUserId: true, staff: true });
  }

  private async applyAiClassificationAfterCreate(
    reportId: string,
    input: {
      photoUrl: string | null;
      description: string;
      lat: number;
      lng: number;
      categoryId: string | null;
      currentStatus: ReportStatus;
      departmentId: string | null;
      institutionId: string | null;
    },
  ): Promise<ReportWithRelations | null> {
    if (!input.photoUrl) {
      return null;
    }

    const classification = await this.aiClassification.classifyReportPhoto({
      photoUrl: input.photoUrl,
      description: input.description,
    });

    const duplicateOfId = await this.findPossibleDuplicate({
      lat: input.lat,
      lng: input.lng,
      categoryId: input.categoryId,
      excludeId: reportId,
    });

    if (!classification) {
      if (!duplicateOfId) {
        return null;
      }
      return this.prisma.report.update({
        where: { id: reportId },
        data: { duplicateOfId, isDuplicate: true },
        include: REPORT_INCLUDE,
      });
    }

    const needsReview = classification.confidence < AI_CONFIDENCE_THRESHOLD;
    const nextStatus = needsReview ? ReportStatus.IN_REVIEW : input.currentStatus;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id: reportId },
        data: {
          aiClassification: classification as unknown as Prisma.InputJsonValue,
          aiConfidence: classification.confidence,
          duplicateOfId: duplicateOfId ?? undefined,
          isDuplicate: duplicateOfId ? true : undefined,
          status: nextStatus,
        },
        include: REPORT_INCLUDE,
      });

      if (nextStatus !== input.currentStatus) {
        await tx.statusHistory.create({
          data: {
            reportId,
            oldStatus: input.currentStatus,
            newStatus: nextStatus,
            changedBy: SYSTEM_ACTOR,
            note: needsReview
              ? 'Besueshmëria e AI është e ulët — kategoria kërkon shqyrtim para radhës'
              : 'Kategoria u konfirmua — raporti hyri në radhën e institucionit',
          },
        });
      }

      return report;
    });

    if (nextStatus !== input.currentStatus) {
      this.events.emit(
        REPORT_STATUS_CHANGED_EVENT,
        new StatusChangedEvent(
          reportId,
          updated.userId,
          input.currentStatus,
          nextStatus,
          SYSTEM_ACTOR,
        ),
      );
    }

    return updated;
  }

  private async findPossibleDuplicate(params: {
    lat: number;
    lng: number;
    categoryId: string | null;
    excludeId: string;
  }): Promise<string | null> {
    const radiusMeters = 100;
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    type DupRow = { id: string };
    const rows = params.categoryId
      ? await this.prisma.$queryRaw<DupRow[]>`
          SELECT r.id
          FROM "Report" r
          WHERE r.id <> ${params.excludeId}
            AND r."createdAt" >= ${since}
            AND r.location IS NOT NULL
            AND r."categoryId" = ${params.categoryId}
            AND ST_DWithin(
              r.location,
              ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography,
              ${radiusMeters}
            )
          ORDER BY r."createdAt" DESC
          LIMIT 1
        `
      : await this.prisma.$queryRaw<DupRow[]>`
          SELECT r.id
          FROM "Report" r
          WHERE r.id <> ${params.excludeId}
            AND r."createdAt" >= ${since}
            AND r.location IS NOT NULL
            AND ST_DWithin(
              r.location,
              ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography,
              ${radiusMeters}
            )
          ORDER BY r."createdAt" DESC
          LIMIT 1
        `;

    return rows[0]?.id ?? null;
  }

  private async resolveCategoryAndPriority(classification: AIClassification): Promise<{
    categoryId?: string;
    departmentId?: string;
    institutionId?: string | null;
    priority: Priority;
  }> {
    const categoryName = AI_CATEGORY_TO_DB_NAME[classification.category];
    const category = await this.prisma.category.findFirst({
      where: { name: categoryName },
      include: { department: { select: { institutionId: true } } },
    });
    return {
      categoryId: category?.id,
      departmentId: category?.departmentId,
      institutionId: category?.department.institutionId ?? null,
      priority: AI_SEVERITY_TO_PRIORITY[classification.severity] as Priority,
    };
  }

  private assertStatusTransition(from: ReportStatus, to: ReportStatus, role: Role) {
    if (!canTransitionStatus(from, to, { bypass: role === Role.SUPER_ADMIN })) {
      throw new BadRequestException(
        `Cannot move a report from ${from} to ${to}. Follow the institution workflow.`,
      );
    }
  }

  private async enterInstitutionQueue(
    reportId: string,
    changedBy: string,
  ): Promise<ReportWithRelations> {
    const existing = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: REPORT_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }
    if (existing.status !== ReportStatus.PENDING) {
      return existing;
    }
    if (!existing.departmentId && !existing.institutionId) {
      return existing;
    }

    const dueAt = existing.dueAt ?? computeDueAt(existing.priority);
    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.ASSIGNED, dueAt },
        include: REPORT_INCLUDE,
      });
      await tx.statusHistory.create({
        data: {
          reportId,
          oldStatus: ReportStatus.PENDING,
          newStatus: ReportStatus.ASSIGNED,
          changedBy,
          note: existing.institutionId
            ? 'U rrugëzua te radha e institucionit përgjegjës'
            : 'U rrugëzua te radha e departamentit përgjegjës',
        },
      });
      return report;
    });

    this.events.emit(
      REPORT_STATUS_CHANGED_EVENT,
      new StatusChangedEvent(
        updated.id,
        existing.userId,
        ReportStatus.PENDING,
        ReportStatus.ASSIGNED,
        changedBy,
      ),
    );

    return updated;
  }

  private async staffQueueScope(user: AuthUser): Promise<Prisma.ReportWhereInput> {
    if (user.role === Role.SUPER_ADMIN) {
      return {};
    }

    const membership = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        departments: { select: { id: true, institutionId: true } },
      },
    });
    const departments = membership?.departments ?? [];
    if (departments.length === 0) {
      return { id: { in: [] } };
    }

    const departmentIds = departments.map((d) => d.id);
    const institutionIds = departments
      .map((d) => d.institutionId)
      .filter((id): id is string => Boolean(id));

    return {
      OR: [
        { departmentId: { in: departmentIds } },
        ...(institutionIds.length ? [{ institutionId: { in: institutionIds } }] : []),
      ],
    };
  }

  private buildWhere(query: ListReportsQueryDto): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.institutionId) where.institutionId = query.institutionId;
    if (query.priority) where.priority = query.priority;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }

    if (query.bbox) {
      const parts = query.bbox.split(',').map((p) => Number(p.trim()));
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        throw new BadRequestException('bbox must be minLng,minLat,maxLng,maxLat');
      }
      const [minLng, minLat, maxLng, maxLat] = parts;
      where.lng = { gte: minLng, lte: maxLng };
      where.lat = { gte: minLat, lte: maxLat };
    }

    return where;
  }

  private canSeeUserId(viewer: AuthUser | null, ownerId: string): boolean {
    if (!viewer) return false;
    if (viewer.id === ownerId) return true;
    return STAFF_ROLES.includes(viewer.role as Role);
  }

  private toDto(
    report: ReportWithRelations,
    opts: { includeUserId: boolean; votedByMe?: boolean; staff?: boolean },
  ): ReportDto {
    const history: StatusHistoryDto[] | undefined = report.statusHistory?.map((row) => ({
      id: row.id,
      oldStatus: row.oldStatus,
      newStatus: row.newStatus,
      changedAt: row.changedAt.toISOString(),
      note: row.note,
    }));
    const latestNote =
      history
        ?.slice()
        .reverse()
        .find((row) => row.note)?.note ?? null;

    const dto: ReportDto = {
      id: report.id,
      publicId: report.publicId,
      categoryId: report.categoryId,
      subcategory: report.subcategory,
      departmentId: report.departmentId,
      institutionId: report.institutionId,
      description: report.description,
      status: report.status,
      priority: report.priority,
      lat: report.lat,
      lng: report.lng,
      address: report.address,
      photoUrl: report.photoUrl,
      photoAfterUrl: report.photoAfterUrl,
      aiClassification: (report.aiClassification as ReportDto['aiClassification']) ?? null,
      aiConfidence: report.aiConfidence,
      aiNeedsReview:
        report.aiConfidence !== null && report.aiConfidence < AI_CONFIDENCE_THRESHOLD
          ? true
          : report.aiConfidence !== null
            ? false
            : null,
      duplicateOfId: report.duplicateOfId ?? null,
      isDuplicate: report.isDuplicate ?? false,
      assignedStaffId: report.assignedStaffId ?? null,
      dueAt: report.dueAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      categoryName: report.category?.name ?? null,
      departmentName: report.department?.name ?? null,
      institutionName: report.institution?.name ?? null,
      voteCount: report._count?.votes ?? 0,
      latestNote,
    };

    if (history) {
      dto.history = history;
    }
    if (opts.staff) {
      dto.allowedActions = allowedWorkflowActions(report.status);
    }

    if (opts.includeUserId) {
      dto.userId = report.userId;
    }
    if (opts.votedByMe !== undefined) {
      dto.votedByMe = opts.votedByMe;
    }

    return dto;
  }

  private toCommentDto(row: {
    id: string;
    reportId: string;
    text: string;
    createdAt: Date;
    user: { name: string };
  }): CommentDto {
    return {
      id: row.id,
      reportId: row.reportId,
      text: row.text,
      authorName: row.user.name,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
