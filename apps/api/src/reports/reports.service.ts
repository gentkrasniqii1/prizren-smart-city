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
  allowedModerationActions,
  allowedWorkflowActions,
  canTransitionStatus,
  isPublicReportStatus,
  MODERATION_ACTIONS_REQUIRING_NOTE,
  PUBLIC_REPORT_STATUSES,
  QUEUE_LANES,
  QUEUE_LANE_STATUSES,
  WORKFLOW_ACTION_TARGET,
  WORKFLOW_ACTIONS_REQUIRING_NOTE,
} from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ConfigService } from '../auth/config.service';
import { AuditService } from '../audit/audit.service';
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
import { CreateReportFields, MAX_REPORT_PHOTOS } from './dto/create-report.dto';
import { resolveReportMedia } from './report-media';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { UpdateAiClassificationDto } from './dto/update-ai-classification.dto';
import { AssignReportDto } from './dto/assign-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import {
  AddReportNoteDto,
  EscalateReportDto,
  UpdateReportPriorityDto,
} from './dto/update-report-priority.dto';
import { computeDueAt, computeDueAtFromHours } from './sla';
import { nextReportPublicId, reportWhereByRef } from './public-id';
import { WorkflowActionDto } from './dto/workflow-action.dto';
import { ModerateReportDto } from './dto/moderate-report.dto';
import {
  REPORT_CREATED_EVENT,
  REPORT_STATUS_CHANGED_EVENT,
  ReportCreatedEvent,
  StatusChangedEvent,
} from '../events/status-changed.event';
import { assertValidImageUpload } from '../uploads/image-validation';
import { RoutingService } from '../routing/routing.service';
import { resolveActiveSubcategory } from '../common/subcategory-ref';
import {
  isStaffUser,
  STAFF_ROLES,
  viewerCanAccessReport,
  publicStatusHistory,
  canCommentOnReport,
} from './visibility';

const AI_ADMIN_ROLES: Role[] = [Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];
const OPEN_STATUSES: ReportStatus[] = [
  ReportStatus.SUBMITTED,
  ReportStatus.UNDER_REVIEW,
  ReportStatus.ASSIGNED,
  ReportStatus.RECEIVED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.WAITING_FOR_INFORMATION,
];
const SYSTEM_ACTOR = 'SYSTEM';

/** Shared `include` shape so every Report query returns display names consistently. */
const REPORT_INCLUDE = {
  category: { select: { name: true } },
  subcategoryRef: { select: { name: true } },
  department: { select: { name: true } },
  institution: { select: { name: true } },
  _count: { select: { votes: true } },
  media: { orderBy: [{ role: 'asc' as const }, { sortOrder: 'asc' as const }] },
} satisfies Prisma.ReportInclude;

const REPORT_DETAIL_INCLUDE = {
  ...REPORT_INCLUDE,
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.ReportInclude;

type ReportWithRelations = Report & {
  category?: { name: string } | null;
  subcategoryRef?: { name: string } | null;
  department?: { name: string } | null;
  institution?: { name: string } | null;
  _count?: { votes: number };
  media?: Array<{
    id: string;
    role: string;
    sortOrder: number;
    url: string;
    mimeType: string | null;
    visibility: string;
    createdAt: Date;
  }>;
  statusHistory?: Array<{
    id: string;
    reportId: string;
    oldStatus: ReportStatus;
    newStatus: ReportStatus;
    changedBy: string;
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
    private readonly audit: AuditService,
  ) {}

  async create(
    user: AuthUser,
    fields: CreateReportFields,
    files: Express.Multer.File[] = [],
  ): Promise<ReportDto> {
    if (files.length > MAX_REPORT_PHOTOS) {
      throw new BadRequestException(`at most ${MAX_REPORT_PHOTOS} photos are allowed`);
    }

    const uploaded: Array<{
      url: string;
      mimeType: string;
      byteSize: number;
      cloudinaryId: string;
    }> = [];
    for (const [index, file] of files.entries()) {
      const mimeType = await assertValidImageUpload(file);
      const cloudinaryId = `report-${user.id}-${Date.now()}-${index}`;
      const url = await this.cloudinary.uploadImage(file.buffer, cloudinaryId);
      uploaded.push({ url, mimeType, byteSize: file.size, cloudinaryId });
    }
    const photoUrl = uploaded[0]?.url;

    const subcategory = await resolveActiveSubcategory(this.prisma, {
      subcategoryId: fields.subcategoryId,
      categoryId: fields.categoryId ?? null,
    });
    const categoryId = fields.categoryId ?? subcategory?.categoryId ?? null;

    const routed = categoryId
      ? await this.routing.route({
          categoryId,
          subcategoryId: subcategory?.subcategoryId,
          subcategory: subcategory?.subcategory,
        })
      : null;

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
          categoryId,
          subcategoryId: subcategory?.subcategoryId ?? null,
          subcategory: subcategory?.subcategory ?? null,
          departmentId: routed?.departmentId,
          institutionId: routed?.institutionId ?? undefined,
          priority: routed?.defaultPriority ?? null,
          photoUrl,
          status: ReportStatus.SUBMITTED,
          ...(uploaded.length
            ? {
                media: {
                  create: uploaded.map((item, sortOrder) => ({
                    role: 'INITIAL' as const,
                    sortOrder,
                    url: item.url,
                    cloudinaryId: item.cloudinaryId,
                    mimeType: item.mimeType,
                    byteSize: item.byteSize,
                    visibility: 'PUBLIC' as const,
                  })),
                },
              }
            : {}),
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
      categoryId,
      currentStatus: report.status,
    });

    const result = classified ?? report;

    if (routed) {
      await this.audit.log({
        userId: user.id,
        action: 'report.route',
        entityType: 'Report',
        entityId: result.id,
        metadata: {
          source: routed.source,
          official: false,
          categoryId: routed.categoryId,
          departmentId: routed.departmentId,
          institutionId: routed.institutionId,
          matchedRuleId: routed.matchedRuleId,
          slaHours: routed.slaHours,
        },
      });
    }

    await this.audit.log({
      userId: user.id,
      action: 'report.create',
      entityType: 'Report',
      entityId: result.id,
      metadata: {
        publicId: result.publicId,
        categoryId: result.categoryId,
        status: result.status,
        duplicateOfId: result.duplicateOfId,
        photoCount: uploaded.length,
      },
    });

    this.events.emit(REPORT_CREATED_EVENT, new ReportCreatedEvent(result.id, user.id));

    try {
      await this.mail.sendReportReceivedEmail(user.email, {
        reportId: report.id,
        description: fields.description,
        reportUrl: `${this.config.webOrigin}/reports/${report.id}`,
      });
    } catch {
      this.logger.error(
        JSON.stringify({ event: 'mail.report_received_failed', reportId: report.id }),
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
      subcategoryId: string | null;
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
        r."subcategoryId",
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
        ${
          isStaffUser(viewer)
            ? Prisma.empty
            : Prisma.sql`AND r.status IN ('ASSIGNED'::"ReportStatus", 'RECEIVED'::"ReportStatus", 'IN_PROGRESS'::"ReportStatus", 'WAITING_FOR_INFORMATION'::"ReportStatus", 'RESOLVED'::"ReportStatus")`
        }
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
        {
          includeUserId: this.canSeeUserId(viewer, row.userId),
          staff: isStaffUser(viewer),
        },
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
    const staff = isStaffUser(viewer);
    const where: Prisma.ReportWhereInput = {
      ...this.buildWhere(query),
      ...this.publicListConstraint(viewer, query.status),
    };

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
          staff,
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
      where: reportWhereByRef(id),
      include: REPORT_DETAIL_INCLUDE,
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (!viewerCanAccessReport(report, viewer)) {
      throw new NotFoundException('Report not found');
    }

    let votedByMe: boolean | undefined;
    if (viewer) {
      const vote = await this.prisma.vote.findUnique({
        where: {
          reportId_userId: { reportId: report.id, userId: viewer.id },
        },
      });
      votedByMe = Boolean(vote);
    }

    return this.toDto(report, {
      includeUserId: this.canSeeUserId(viewer, report.userId),
      votedByMe,
      staff: isStaffUser(viewer),
    });
  }

  async listMine(user: AuthUser, page = 1, limit = 20): Promise<PaginatedReports> {
    const where = { userId: user.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: REPORT_DETAIL_INCLUDE,
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
          status: { in: [ReportStatus.ASSIGNED, ReportStatus.RECEIVED, ReportStatus.IN_PROGRESS] },
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
    if (existing.status === dto.status && !dto.note?.trim()) {
      throw new BadRequestException('Status is already set to this value');
    }

    if (
      (existing.status === ReportStatus.SUBMITTED ||
        existing.status === ReportStatus.UNDER_REVIEW) &&
      dto.status === ReportStatus.ASSIGNED
    ) {
      throw new BadRequestException(
        'Use POST /reports/:id/moderate with action approve to enter the institution queue',
      );
    }

    if (existing.status !== dto.status) {
      this.assertStatusTransition(existing.status, dto.status, user.role as Role);
    }

    if (dto.status === ReportStatus.RESOLVED && !existing.photoAfterUrl) {
      throw new BadRequestException(
        'photoAfterUrl is required before resolving. Upload via POST /reports/:id/photo-after',
      );
    }

    const nextDueAt =
      (dto.status === ReportStatus.ASSIGNED || dto.status === ReportStatus.RECEIVED) &&
      !existing.dueAt
        ? computeDueAt(existing.priority)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          status: dto.status,
          ...(nextDueAt ? { dueAt: nextDueAt } : {}),
          ...(dto.status === ReportStatus.DUPLICATE && existing.duplicateOfId
            ? { isDuplicate: true }
            : {}),
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

      await this.audit.log(
        {
          userId: user.id,
          action: dto.status === ReportStatus.RESOLVED ? 'report.resolve' : 'report.status_update',
          entityType: 'Report',
          entityId: id,
          oldValue: { status: existing.status },
          newValue: { status: dto.status },
          ipAddress: ipAddress ?? undefined,
          metadata: {
            oldStatus: existing.status,
            newStatus: dto.status,
            note: dto.note ?? null,
            dueAt: report.dueAt?.toISOString() ?? null,
          },
        },
        tx,
      );

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

  async moderate(
    id: string,
    user: AuthUser,
    dto: ModerateReportDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can moderate reports');
    }

    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Report not found');
    }

    const allowed = allowedModerationActions(existing.status);
    if (!allowed.includes(dto.action)) {
      throw new BadRequestException(
        `Cannot apply ${dto.action} while the report is ${existing.status}`,
      );
    }

    const note = dto.note?.trim();
    if (MODERATION_ACTIONS_REQUIRING_NOTE.includes(dto.action) && !note) {
      throw new BadRequestException('note is required for this action');
    }

    if (dto.action === 'approve') {
      return this.approveOfficialCase(existing, user, dto, ipAddress);
    }

    if (dto.action === 'start_review') {
      return this.moderateStatusChange(
        id,
        user,
        dto.action,
        { status: ReportStatus.UNDER_REVIEW, note },
        ipAddress,
      );
    }

    if (dto.action === 'request_information') {
      const labelled = `Kërkesë për informacion: ${note}`;
      return this.moderateStatusChange(
        id,
        user,
        dto.action,
        { status: ReportStatus.UNDER_REVIEW, note: labelled },
        ipAddress,
      );
    }

    if (dto.action === 'mark_duplicate') {
      if (!dto.duplicateOfId) {
        throw new BadRequestException('duplicateOfId is a required field');
      }
      if (dto.duplicateOfId === id) {
        throw new BadRequestException('A report cannot be a duplicate of itself');
      }
      const original = await this.prisma.report.findUnique({
        where: { id: dto.duplicateOfId },
        select: { id: true, publicId: true },
      });
      if (!original) {
        throw new BadRequestException('Original report not found');
      }

      await this.prisma.report.update({
        where: { id },
        data: { duplicateOfId: original.id, isDuplicate: true },
      });

      return this.moderateStatusChange(
        id,
        user,
        dto.action,
        {
          status: ReportStatus.DUPLICATE,
          note: note
            ? `${note} (origjinali: ${original.publicId})`
            : `Origjinali: ${original.publicId}`,
        },
        ipAddress,
        { duplicateOfId: original.id },
      );
    }

    const reason = dto.action === 'reject_spam' ? 'spam' : 'invalid';
    return this.moderateStatusChange(
      id,
      user,
      dto.action,
      { status: ReportStatus.REJECTED, note: `[${reason}] ${note}` },
      ipAddress,
    );
  }

  private async moderateStatusChange(
    id: string,
    user: AuthUser,
    moderationAction: ModerateReportDto['action'],
    statusDto: UpdateReportStatusDto,
    ipAddress?: string | null,
    extra?: { duplicateOfId?: string },
  ): Promise<ReportDto> {
    const result = await this.updateStatus(id, user, statusDto, ipAddress);
    await this.audit.log({
      userId: user.id,
      action: 'report.moderate',
      entityType: 'Report',
      entityId: id,
      ipAddress: ipAddress ?? undefined,
      metadata: {
        moderationAction,
        newStatus: result.status,
        duplicateOfId: extra?.duplicateOfId ?? null,
      },
    });
    return result;
  }

  async listQueue(user: AuthUser, query: ListReportsQueryDto): Promise<PaginatedReports> {
    if (!STAFF_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only staff/admin can open the institution queue');
    }

    const lane: QueueLane = query.lane ?? 'pending';
    const deskScope = await this.staffQueueScope(user);
    const scope = lane === 'pending' ? {} : deskScope;
    const laneStatuses = QUEUE_LANE_STATUSES[lane] as ReportStatus[];

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReportWhereInput = {
      ...this.buildWhere(query),
      ...scope,
      status: query.status ?? { in: laneStatuses },
    };

    const orderBy: Prisma.ReportOrderByWithRelationInput[] =
      lane === 'pending'
        ? [{ priority: 'desc' }, { createdAt: 'asc' }]
        : [{ priority: 'desc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }];

    const laneCountWheres = QUEUE_LANES.map((item) => ({
      ...(item === 'pending' ? {} : deskScope),
      status: { in: QUEUE_LANE_STATUSES[item] as ReportStatus[] },
    }));

    const [total, rows, laneTotals] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      Promise.all(
        laneCountWheres.map((laneWhere) => this.prisma.report.count({ where: laneWhere })),
      ),
    ]);

    const laneCounts = Object.fromEntries(
      QUEUE_LANES.map((item, index) => [item, laneTotals[index] ?? 0]),
    ) as Record<QueueLane, number>;

    return {
      data: rows.map((row) => this.toDto(row, { includeUserId: true, staff: true })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        laneCounts,
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

    if (
      existing.status === ReportStatus.SUBMITTED ||
      existing.status === ReportStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        'Approve the report before assigning staff or changing the institution desk',
      );
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

    const dueAt = existing.dueAt ?? computeDueAt(existing.priority);

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          departmentId: departmentId ?? null,
          institutionId: institutionId ?? null,
          assignedStaffId:
            dto.assignedStaffId === undefined ? existing.assignedStaffId : dto.assignedStaffId,
          dueAt,
        },
        include: REPORT_INCLUDE,
      });

      await this.audit.log(
        {
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
        tx,
      );

      return report;
    });

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

      await this.audit.log(
        {
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
        tx,
      );

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
      existing.status === ReportStatus.SUBMITTED ? ReportStatus.UNDER_REVIEW : existing.status;
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

      await this.audit.log(
        {
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
        tx,
      );

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

    await this.audit.log({
      userId: user.id,
      action: 'report.note',
      entityType: 'Report',
      entityId: id,
      ipAddress: ipAddress ?? undefined,
      metadata: { note },
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
    const cloudinaryId = `report-${id}-after-${Date.now()}`;
    const photoAfterUrl = await this.cloudinary.uploadImage(file.buffer, cloudinaryId);
    const afterCount = await this.prisma.reportMedia.count({
      where: { reportId: id, role: 'AFTER' },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          photoAfterUrl,
          media: {
            create: {
              role: 'AFTER',
              sortOrder: afterCount,
              url: photoAfterUrl,
              cloudinaryId,
              mimeType: file.mimetype,
              byteSize: file.size,
              visibility: 'PUBLIC',
            },
          },
        },
        include: REPORT_INCLUDE,
      });

      await this.audit.log(
        {
          userId: user.id,
          action: 'report.photo_after_upload',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: { cloudinaryId, mimeType: file.mimetype, byteSize: file.size },
        },
        tx,
      );

      return report;
    });

    return this.toDto(updated, { includeUserId: true });
  }

  async addVote(id: string, user: AuthUser): Promise<VoteCountResponse> {
    const report = await this.prisma.report.findUnique({ where: reportWhereByRef(id) });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    this.assertCanInteract(report, user);

    try {
      await this.prisma.vote.create({
        data: { reportId: report.id, userId: user.id },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // already voted — idempotent
      } else {
        throw err;
      }
    }

    const voteCount = await this.prisma.vote.count({ where: { reportId: report.id } });
    return { voteCount, votedByMe: true };
  }

  async removeVote(id: string, user: AuthUser): Promise<VoteCountResponse> {
    const report = await this.prisma.report.findUnique({ where: reportWhereByRef(id) });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    this.assertCanInteract(report, user);

    await this.prisma.vote.deleteMany({
      where: { reportId: report.id, userId: user.id },
    });

    const voteCount = await this.prisma.vote.count({ where: { reportId: report.id } });
    return { voteCount, votedByMe: false };
  }

  async listComments(
    id: string,
    page = 1,
    limit = 20,
    viewer: AuthUser | null = null,
  ): Promise<PaginatedComments> {
    const report = await this.prisma.report.findUnique({ where: reportWhereByRef(id) });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (!viewerCanAccessReport(report, viewer)) {
      throw new NotFoundException('Report not found');
    }

    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 ? Math.min(limit, 50) : 20;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where: { reportId: report.id } }),
      this.prisma.comment.findMany({
        where: { reportId: report.id },
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

    const report = await this.prisma.report.findUnique({ where: reportWhereByRef(id) });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    if (!canCommentOnReport(report, user)) {
      throw new NotFoundException('Report not found');
    }

    const created = await this.prisma.comment.create({
      data: {
        reportId: report.id,
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

    const routed = await this.routeFromClassification(classification);
    const dueAt = existing.dueAt;
    const nextStatus = existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          aiClassification: classification as unknown as Prisma.InputJsonValue,
          aiConfidence: classification.confidence,
          categoryId: routed?.categoryId ?? existing.categoryId,
          departmentId: routed?.departmentId ?? existing.departmentId,
          institutionId: routed?.institutionId ?? existing.institutionId,
          priority: routed?.defaultPriority ?? existing.priority,
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

      await this.audit.log(
        {
          userId: user.id,
          action:
            dto.action === 'accept'
              ? 'report.ai_classification_accept'
              : 'report.ai_classification_edit',
          entityType: 'Report',
          entityId: id,
          ipAddress: ipAddress ?? undefined,
          metadata: JSON.parse(
            JSON.stringify({
              category: classification.category,
              severity: classification.severity,
              confidence: classification.confidence,
            }),
          ) as Prisma.InputJsonValue,
        },
        tx,
      );

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
    const nextStatus = needsReview ? ReportStatus.UNDER_REVIEW : input.currentStatus;

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
            note: 'Besueshmëria e AI është e ulët — kërkon shqyrtim njerëzor. AI nuk e bën rastin zyrtar.',
          },
        });
      }

      await this.audit.log(
        {
          userId: report.userId,
          actorType: 'SYSTEM',
          action: 'report.ai_classification',
          entityType: 'Report',
          entityId: reportId,
          metadata: JSON.parse(
            JSON.stringify({
              confidence: classification.confidence,
              needsReview,
              category: classification.category,
            }),
          ) as Prisma.InputJsonValue,
        },
        tx,
      );

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

  /** Map an AI category label onto a DB category, then let RoutingService assign. */
  private async routeFromClassification(classification: AIClassification) {
    const categoryName = AI_CATEGORY_TO_DB_NAME[classification.category];
    const category = await this.prisma.category.findFirst({
      where: { name: categoryName },
      select: { id: true },
    });
    if (!category) return null;
    return this.routing.route({
      categoryId: category.id,
      severity: AI_SEVERITY_TO_PRIORITY[classification.severity] as Priority,
      isEmergency: classification.severity === 'critical',
    });
  }

  private assertStatusTransition(from: ReportStatus, to: ReportStatus, role: Role) {
    if (!canTransitionStatus(from, to, { bypass: role === Role.SUPER_ADMIN })) {
      throw new BadRequestException(
        `Cannot move a report from ${from} to ${to}. Follow the institution workflow.`,
      );
    }
  }

  /**
   * Human approval is the only path into the institution queue.
   * RoutingService.route() must resolve a department or institution first.
   */
  private async approveOfficialCase(
    existing: Report,
    user: AuthUser,
    dto: ModerateReportDto,
    ipAddress?: string | null,
  ): Promise<ReportDto> {
    const categoryId = dto.categoryId ?? existing.categoryId;
    if (!categoryId) {
      throw new BadRequestException(
        'categoryId is required before approving a report into the institution queue',
      );
    }

    // New subcategory selection must be active and belong to category; existing FK is preserved.
    const subcategory = dto.subcategoryId
      ? await resolveActiveSubcategory(this.prisma, {
          subcategoryId: dto.subcategoryId,
          categoryId,
        })
      : existing.subcategoryId
        ? {
            subcategoryId: existing.subcategoryId,
            subcategory: existing.subcategory ?? '',
            categoryId: existing.categoryId ?? categoryId,
          }
        : null;
    if (subcategory && subcategory.categoryId !== categoryId && dto.subcategoryId) {
      throw new BadRequestException('Subcategory does not belong to the selected category');
    }

    const routed = await this.routing.route({
      categoryId,
      subcategoryId: subcategory?.subcategoryId ?? null,
      subcategory: subcategory?.subcategory || existing.subcategory,
      severity: existing.priority,
    });

    if (!routed.departmentId && !routed.institutionId) {
      throw new BadRequestException(
        'Cannot approve: routing did not resolve a department or institution',
      );
    }

    const dueAt = existing.dueAt ?? computeDueAtFromHours(routed.slaHours);
    const note =
      dto.note?.trim() ||
      (routed.institutionId
        ? 'U miratua dhe u rrugëzua te radha e institucionit përgjegjës'
        : 'U miratua dhe u rrugëzua te radha e departamentit përgjegjës');

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id: existing.id },
        data: {
          categoryId: routed.categoryId,
          subcategoryId: subcategory?.subcategoryId ?? null,
          subcategory: subcategory?.subcategory || existing.subcategory,
          departmentId: routed.departmentId,
          institutionId: routed.institutionId,
          priority: routed.defaultPriority,
          status: ReportStatus.ASSIGNED,
          dueAt,
        },
        include: REPORT_DETAIL_INCLUDE,
      });
      await tx.statusHistory.create({
        data: {
          reportId: existing.id,
          oldStatus: existing.status,
          newStatus: ReportStatus.ASSIGNED,
          changedBy: user.id,
          note,
        },
      });
      await this.audit.log(
        {
          userId: user.id,
          action: 'report.approve',
          entityType: 'Report',
          entityId: existing.id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            oldStatus: existing.status,
            newStatus: ReportStatus.ASSIGNED,
            categoryId: routed.categoryId,
            departmentId: routed.departmentId,
            institutionId: routed.institutionId,
            matchedRuleId: routed.matchedRuleId,
            matchedRuleName: routed.matchedRuleName,
            source: routed.source,
            slaHours: routed.slaHours,
            defaultPriority: routed.defaultPriority,
          },
        },
        tx,
      );
      await this.audit.log(
        {
          userId: user.id,
          action: 'report.route',
          entityType: 'Report',
          entityId: existing.id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            official: true,
            source: routed.source,
            categoryId: routed.categoryId,
            departmentId: routed.departmentId,
            institutionId: routed.institutionId,
            matchedRuleId: routed.matchedRuleId,
            slaHours: routed.slaHours,
          },
        },
        tx,
      );
      await this.audit.log(
        {
          userId: user.id,
          action: 'report.queue_enter',
          entityType: 'Report',
          entityId: existing.id,
          ipAddress: ipAddress ?? undefined,
          metadata: {
            publicId: report.publicId,
            status: ReportStatus.ASSIGNED,
            departmentId: routed.departmentId,
            institutionId: routed.institutionId,
          },
        },
        tx,
      );
      return report;
    });

    this.events.emit(
      REPORT_STATUS_CHANGED_EVENT,
      new StatusChangedEvent(
        updated.id,
        existing.userId,
        existing.status,
        ReportStatus.ASSIGNED,
        user.id,
        note,
      ),
    );

    return this.toDto(updated, { includeUserId: true, staff: true });
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

  /** Non-staff lists never include unapproved, rejected, or duplicate cases. */
  private publicListConstraint(
    viewer: AuthUser | null,
    requestedStatus?: ReportStatus,
  ): Prisma.ReportWhereInput {
    if (isStaffUser(viewer)) {
      return {};
    }
    if (requestedStatus) {
      return isPublicReportStatus(requestedStatus) ? {} : { id: { in: [] } };
    }
    return { status: { in: PUBLIC_REPORT_STATUSES as ReportStatus[] } };
  }

  private assertCanInteract(report: { status: ReportStatus; userId: string }, viewer: AuthUser) {
    if (!viewerCanAccessReport(report, viewer)) {
      throw new NotFoundException('Report not found');
    }
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
      reportId: row.reportId,
      oldStatus: row.oldStatus,
      newStatus: row.newStatus,
      changedBy: row.changedBy,
      changedAt: row.changedAt.toISOString(),
      note: row.note,
    }));
    const staff = Boolean(opts.staff);
    const showInternalNotes = staff || (opts.includeUserId && !isPublicReportStatus(report.status));
    const latestNote =
      history
        ?.slice()
        .reverse()
        .find((row) => row.note)?.note ?? null;

    const dto: ReportDto = {
      id: report.id,
      publicId: report.publicId,
      categoryId: report.categoryId,
      subcategoryId: report.subcategoryId,
      subcategory: report.subcategoryRef?.name ?? report.subcategory,
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
      media: resolveReportMedia({
        media: report.media,
        photoUrl: report.photoUrl,
        photoAfterUrl: report.photoAfterUrl,
        staff,
      }),
      aiClassification: staff
        ? ((report.aiClassification as ReportDto['aiClassification']) ?? null)
        : null,
      aiConfidence: staff ? report.aiConfidence : null,
      aiNeedsReview: staff
        ? report.aiConfidence !== null && report.aiConfidence < AI_CONFIDENCE_THRESHOLD
          ? true
          : report.aiConfidence !== null
            ? false
            : null
        : null,
      duplicateOfId: staff ? (report.duplicateOfId ?? null) : null,
      isDuplicate: report.isDuplicate ?? false,
      assignedStaffId: staff ? (report.assignedStaffId ?? null) : null,
      source: staff ? report.source : undefined,
      anonymous: report.anonymous,
      language: report.language,
      dueAt: report.dueAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      categoryName: report.category?.name ?? null,
      departmentName: report.department?.name ?? null,
      institutionName: report.institution?.name ?? null,
      voteCount: report._count?.votes ?? 0,
      latestNote: showInternalNotes ? latestNote : null,
    };

    if (history) {
      const visible = staff ? history : publicStatusHistory(history, report.status);
      dto.history = showInternalNotes
        ? visible
        : visible.map((row) => ({
            ...row,
            changedBy: undefined,
            note: null,
          }));
    }
    if (staff) {
      dto.allowedActions = allowedWorkflowActions(report.status);
      dto.allowedModerationActions = allowedModerationActions(report.status);
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
