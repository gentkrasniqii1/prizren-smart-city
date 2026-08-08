import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Report, ReportStatus, Role } from '@prisma/client';
import type { PaginatedReports, ReportDto } from '@prizren/shared-types';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { ALLOWED_IMAGE_MIME, CreateReportFields, MAX_IMAGE_BYTES } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';

const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

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

    return this.toDto(report, { includeUserId: true });
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
