import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Priority, Report, ReportStatus, Role } from '@prisma/client';
import type { AIClassification, PaginatedReports, ReportDto } from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AiClassificationService } from '../ai/ai-classification.service';
import {
  AI_CATEGORY_TO_DB_NAME,
  AI_CONFIDENCE_THRESHOLD,
  AI_SEVERITY_TO_PRIORITY,
  parseAIClassification,
} from '../ai/ai-classification.schema';
import { ALLOWED_IMAGE_MIME, CreateReportFields, MAX_IMAGE_BYTES } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { UpdateAiClassificationDto } from './dto/update-ai-classification.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];
const AI_ADMIN_ROLES: Role[] = [Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

type ReportWithRelations = Report & {
  category?: { name: string } | null;
  department?: { name: string } | null;
  _count?: { votes: number };
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly aiClassification: AiClassificationService,
  ) {}

  async create(
    user: AuthUser,
    fields: CreateReportFields,
    file?: Express.Multer.File,
  ): Promise<ReportDto> {
    let photoUrl: string | undefined;
    if (file) {
      this.assertValidImage(file);
      const publicId = `report-${user.id}-${Date.now()}`;
      photoUrl = await this.cloudinary.uploadImage(file.buffer, publicId);
    }

    let departmentId: string | undefined;
    if (fields.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: fields.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Invalid categoryId');
      }
      departmentId = category.departmentId;
    }

    const report = await this.prisma.report.create({
      data: {
        userId: user.id,
        description: fields.description,
        lat: fields.lat,
        lng: fields.lng,
        address: fields.address,
        categoryId: fields.categoryId,
        departmentId,
        photoUrl,
        status: ReportStatus.PENDING,
      },
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    });

    await this.syncReportLocation(report.id, fields.lat, fields.lng);

    const classified = await this.applyAiClassificationAfterCreate(report.id, {
      photoUrl: photoUrl ?? null,
      description: fields.description,
      lat: fields.lat,
      lng: fields.lng,
      categoryId: fields.categoryId ?? null,
    });

    return this.toDto(classified ?? report, { includeUserId: true });
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
      userId: string;
      categoryId: string | null;
      departmentId: string | null;
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
      assignedStaffId: string | null;
      dueAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      categoryName: string | null;
      departmentName: string | null;
      voteCount: number;
    };

    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        r.id,
        r."userId",
        r."categoryId",
        r."departmentId",
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
        r."assignedStaffId",
        r."dueAt",
        r."createdAt",
        r."updatedAt",
        c.name AS "categoryName",
        d.name AS "departmentName",
        COALESCE(v.cnt, 0)::int AS "voteCount"
      FROM "Report" r
      LEFT JOIN "Category" c ON c.id = r."categoryId"
      LEFT JOIN "Department" d ON d.id = r."departmentId"
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
        include: {
          category: { select: { name: true } },
          department: { select: { name: true } },
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) =>
        this.toDto(row, { includeUserId: this.canSeeUserId(viewer, row.userId) }),
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
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.toDto(report, {
      includeUserId: this.canSeeUserId(viewer, report.userId),
    });
  }

  async listMine(user: AuthUser, page = 1, limit = 20): Promise<PaginatedReports> {
    const where = { userId: user.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          category: { select: { name: true } },
          department: { select: { name: true } },
          _count: { select: { votes: true } },
        },
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

  async updateStatus(id: string, user: AuthUser, dto: UpdateReportStatusDto): Promise<ReportDto> {
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: { status: dto.status },
        include: {
          category: { select: { name: true } },
          department: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      });

      await tx.statusHistory.create({
        data: {
          reportId: id,
          oldStatus: existing.status,
          newStatus: dto.status,
          changedBy: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'report.status_update',
          entityType: 'Report',
          entityId: id,
          metadata: {
            oldStatus: existing.status,
            newStatus: dto.status,
            note: dto.note ?? null,
          },
        },
      });

      return report;
    });

    return this.toDto(updated, { includeUserId: true });
  }

  async updateAiClassification(
    id: string,
    user: AuthUser,
    dto: UpdateAiClassificationDto,
  ): Promise<ReportDto> {
    if (!AI_ADMIN_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Only department admin or super admin can manage AI classification');
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
        recommendedDepartment:
          dto.recommendedDepartment ?? classification?.recommendedDepartment,
      };
      classification = parseAIClassification(merged);
      if (!classification) {
        throw new BadRequestException('Invalid AI classification payload for edit');
      }
    } else if (!classification) {
      throw new BadRequestException('No AI classification to accept');
    }

    const mapped = await this.resolveCategoryAndPriority(classification);
    const updated = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.update({
        where: { id },
        data: {
          aiClassification: classification as unknown as Prisma.InputJsonValue,
          aiConfidence: classification.confidence,
          categoryId: mapped.categoryId ?? existing.categoryId,
          departmentId: mapped.departmentId ?? existing.departmentId,
          priority: mapped.priority ?? existing.priority,
          status:
            existing.status === ReportStatus.PENDING || existing.status === ReportStatus.IN_REVIEW
              ? ReportStatus.IN_REVIEW
              : existing.status,
        },
        include: {
          category: { select: { name: true } },
          department: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action:
            dto.action === 'accept' ? 'report.ai_classification_accept' : 'report.ai_classification_edit',
          entityType: 'Report',
          entityId: id,
          metadata: JSON.parse(JSON.stringify({ classification })) as Prisma.InputJsonValue,
        },
      });

      return report;
    });

    return this.toDto(updated, { includeUserId: true });
  }

  private async applyAiClassificationAfterCreate(
    reportId: string,
    input: {
      photoUrl: string | null;
      description: string;
      lat: number;
      lng: number;
      categoryId: string | null;
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
        data: { duplicateOfId },
        include: {
          category: { select: { name: true } },
          department: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      });
    }

    const needsReview = classification.confidence < AI_CONFIDENCE_THRESHOLD;
    // Store suggestion only; do not auto-apply category until Accept/Edit.
    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        aiClassification: classification as unknown as Prisma.InputJsonValue,
        aiConfidence: classification.confidence,
        status: needsReview ? ReportStatus.IN_REVIEW : ReportStatus.PENDING,
        duplicateOfId: duplicateOfId ?? undefined,
      },
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        _count: { select: { votes: true } },
      },
    });
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
    priority: Priority;
  }> {
    const categoryName = AI_CATEGORY_TO_DB_NAME[classification.category];
    const category = await this.prisma.category.findFirst({
      where: { name: categoryName },
    });
    return {
      categoryId: category?.id,
      departmentId: category?.departmentId,
      priority: AI_SEVERITY_TO_PRIORITY[classification.severity] as Priority,
    };
  }

  private buildWhere(query: ListReportsQueryDto): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.departmentId) where.departmentId = query.departmentId;

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

  private assertValidImage(file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('photo must be image/jpeg, image/png, or image/webp');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('photo must be at most 5MB');
    }
  }

  private canSeeUserId(viewer: AuthUser | null, ownerId: string): boolean {
    if (!viewer) return false;
    if (viewer.id === ownerId) return true;
    return STAFF_ROLES.includes(viewer.role as Role);
  }

  private toDto(report: ReportWithRelations, opts: { includeUserId: boolean }): ReportDto {
    const dto: ReportDto = {
      id: report.id,
      categoryId: report.categoryId,
      departmentId: report.departmentId,
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
      duplicateOfId: report.duplicateOfId,
      assignedStaffId: report.assignedStaffId,
      dueAt: report.dueAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      categoryName: report.category?.name ?? null,
      departmentName: report.department?.name ?? null,
      voteCount: report._count?.votes ?? 0,
    };

    if (opts.includeUserId) {
      dto.userId = report.userId;
    }

    return dto;
  }
}
