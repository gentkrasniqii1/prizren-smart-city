import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Priority } from '@prisma/client';
import {
  ADMIN_DATA_BLOCKED_RESOURCES,
  ADMIN_DATA_RESOURCES,
  type AdminDataPage,
  type AdminDataResource,
  type AdminDataRow,
  type SlaPolicyDto,
} from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';

const BLOCKED = new Set<string>(ADMIN_DATA_BLOCKED_RESOURCES);
const ALLOWED = new Set<string>(ADMIN_DATA_RESOURCES);

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function emptyToNull(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class AdminDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  assertResource(raw: string): AdminDataResource {
    const key = raw.trim().toLowerCase();
    if (BLOCKED.has(key) || !ALLOWED.has(key)) {
      throw new NotFoundException('Unknown resource');
    }
    return key as AdminDataResource;
  }

  async list(resource: AdminDataResource, opts: { page?: number; limit?: number; q?: string }) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const q = opts.q?.trim() || undefined;
    const skip = (page - 1) * limit;

    const { total, rows } = await this.fetch(resource, { skip, take: limit, q });
    const data: AdminDataRow[] = rows;
    const payload: AdminDataPage = {
      resource,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
    return payload;
  }

  async createSlaPolicy(user: AuthUser, dto: UpsertSlaPolicyDto, ip?: string | null) {
    await this.assertSlaRefs(dto.departmentId, dto.categoryId);
    const created = await this.prisma.slaPolicy.create({
      data: {
        name: dto.name.trim(),
        priority: dto.priority,
        responseTime: dto.responseTime,
        resolutionTime: dto.resolutionTime,
        departmentId: emptyToNull(dto.departmentId),
        categoryId: emptyToNull(dto.categoryId),
        active: dto.active ?? true,
      },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    const row = this.toSlaDto(created);
    await this.audit.log({
      userId: user.id,
      action: 'sla_policy.create',
      entityType: 'SlaPolicy',
      entityId: created.id,
      ipAddress: ip,
      newValue: row as never,
    });
    return row;
  }

  async updateSlaPolicy(id: string, user: AuthUser, dto: UpsertSlaPolicyDto, ip?: string | null) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    await this.assertSlaRefs(dto.departmentId, dto.categoryId);
    const updated = await this.prisma.slaPolicy.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        priority: dto.priority,
        responseTime: dto.responseTime,
        resolutionTime: dto.resolutionTime,
        departmentId:
          dto.departmentId === undefined ? existing.departmentId : emptyToNull(dto.departmentId),
        categoryId:
          dto.categoryId === undefined ? existing.categoryId : emptyToNull(dto.categoryId),
        active: dto.active ?? existing.active,
      },
      include: {
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
    });
    const row = this.toSlaDto(updated);
    await this.audit.log({
      userId: user.id,
      action: 'sla_policy.update',
      entityType: 'SlaPolicy',
      entityId: id,
      ipAddress: ip,
      oldValue: {
        name: existing.name,
        priority: existing.priority,
        responseTime: existing.responseTime,
        resolutionTime: existing.resolutionTime,
      },
      newValue: row as never,
    });
    return row;
  }

  async removeSlaPolicy(id: string, user: AuthUser, ip?: string | null) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SLA policy not found');
    await this.prisma.slaPolicy.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'sla_policy.delete',
      entityType: 'SlaPolicy',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true as const };
  }

  private async fetch(
    resource: AdminDataResource,
    opts: { skip: number; take: number; q?: string },
  ): Promise<{ total: number; rows: AdminDataRow[] }> {
    switch (resource) {
      case 'users':
        return this.listUsers(opts);
      case 'reports':
        return this.listReports(opts);
      case 'institutions':
        return this.listInstitutions(opts);
      case 'departments':
        return this.listDepartments(opts);
      case 'categories':
        return this.listCategories(opts);
      case 'routing-rules':
        return this.listRoutingRules(opts);
      case 'sla-policies':
        return this.listSlaPolicies(opts);
      case 'audit-logs':
        return this.listAuditLogs(opts);
      case 'status-history':
        return this.listStatusHistory(opts);
      default:
        throw new BadRequestException('Unknown resource');
    }
  }

  private async listUsers(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.UserWhereInput = opts.q
      ? {
          OR: [
            { email: { contains: opts.q, mode: 'insensitive' } },
            { name: { contains: opts.q, mode: 'insensitive' } },
            { phone: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
        select: {
          id: true,
          email: true,
          googleId: true,
          appleId: true,
          facebookId: true,
          name: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          emailVerified: true,
          emailVerifiedAt: true,
          totpEnabled: true,
          failedLoginCount: true,
          lockedUntil: true,
          lastLoginAt: true,
          lastLoginIp: true,
          createdAt: true,
          departments: { select: { id: true, name: true } },
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        email: row.email,
        googleId: row.googleId,
        appleId: row.appleId,
        facebookId: row.facebookId,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        role: row.role,
        emailVerified: row.emailVerified,
        emailVerifiedAt: iso(row.emailVerifiedAt),
        totpEnabled: row.totpEnabled,
        failedLoginCount: row.failedLoginCount,
        lockedUntil: iso(row.lockedUntil),
        lastLoginAt: iso(row.lastLoginAt),
        lastLoginIp: row.lastLoginIp,
        createdAt: iso(row.createdAt),
        departmentIds: row.departments.map((d) => d.id).join(', ') || null,
        departmentNames: row.departments.map((d) => d.name).join(', ') || null,
      })),
    };
  }

  private async listReports(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.ReportWhereInput = opts.q
      ? {
          OR: [
            { publicId: { contains: opts.q, mode: 'insensitive' } },
            { description: { contains: opts.q, mode: 'insensitive' } },
            { address: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
        select: {
          id: true,
          publicId: true,
          userId: true,
          categoryId: true,
          subcategory: true,
          departmentId: true,
          institutionId: true,
          description: true,
          status: true,
          priority: true,
          lat: true,
          lng: true,
          address: true,
          photoUrl: true,
          photoAfterUrl: true,
          aiClassification: true,
          aiConfidence: true,
          duplicateOfId: true,
          isDuplicate: true,
          assignedStaffId: true,
          source: true,
          anonymous: true,
          language: true,
          dueAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        ...row,
        aiClassification: row.aiClassification,
        dueAt: iso(row.dueAt),
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      })),
    };
  }

  private async listInstitutions(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.InstitutionWhereInput = opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: 'insensitive' } },
            { slug: { contains: opts.q, mode: 'insensitive' } },
            { type: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.institution.count({ where }),
      this.prisma.institution.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type,
        contact: row.contact,
        active: row.active,
        integrationType: row.integrationType,
        integrationStatus: row.integrationStatus,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  private async listDepartments(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.DepartmentWhereInput = opts.q
      ? { name: { contains: opts.q, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        contact: row.contact,
        slaHours: row.slaHours,
        institutionId: row.institutionId,
      })),
    };
  }

  private async listCategories(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.CategoryWhereInput = opts.q
      ? { name: { contains: opts.q, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        departmentId: row.departmentId,
        slaHours: row.slaHours,
        defaultPriority: row.defaultPriority,
      })),
    };
  }

  private async listRoutingRules(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.RoutingRuleWhereInput = opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: 'insensitive' } },
            { subcategory: { contains: opts.q, mode: 'insensitive' } },
            { zone: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.routingRule.count({ where }),
      this.prisma.routingRule.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryId: row.categoryId,
        subcategory: row.subcategory,
        severity: row.severity,
        zone: row.zone,
        isEmergency: row.isEmergency,
        departmentId: row.departmentId,
        institutionId: row.institutionId,
        priority: row.priority,
        slaHours: row.slaHours,
        defaultPriority: row.defaultPriority,
        active: row.active,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      })),
    };
  }

  private async listSlaPolicies(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.SlaPolicyWhereInput = opts.q
      ? { name: { contains: opts.q, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.slaPolicy.count({ where }),
      this.prisma.slaPolicy.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
        skip: opts.skip,
        take: opts.take,
        include: {
          department: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
    ]);
    return { total, rows: rows.map((row) => this.toSlaDto(row) as unknown as AdminDataRow) };
  }

  private async listAuditLogs(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.AuditLogWhereInput = opts.q
      ? {
          OR: [
            { action: { contains: opts.q, mode: 'insensitive' } },
            { entityType: { contains: opts.q, mode: 'insensitive' } },
            { entityId: { contains: opts.q, mode: 'insensitive' } },
            { userId: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        actorType: row.actorType,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        oldValue: row.oldValue,
        newValue: row.newValue,
        metadata: row.metadata,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  private async listStatusHistory(opts: { skip: number; take: number; q?: string }) {
    const where: Prisma.StatusHistoryWhereInput = opts.q
      ? {
          OR: [
            { reportId: { contains: opts.q, mode: 'insensitive' } },
            { changedBy: { contains: opts.q, mode: 'insensitive' } },
            { note: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.statusHistory.count({ where }),
      this.prisma.statusHistory.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        id: row.id,
        reportId: row.reportId,
        oldStatus: row.oldStatus,
        newStatus: row.newStatus,
        changedBy: row.changedBy,
        note: row.note,
        changedAt: iso(row.changedAt),
      })),
    };
  }

  private toSlaDto(row: {
    id: string;
    name: string;
    priority: Priority;
    responseTime: number;
    resolutionTime: number;
    departmentId: string | null;
    categoryId: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    department?: { name: string } | null;
    category?: { name: string } | null;
  }): SlaPolicyDto {
    return {
      id: row.id,
      name: row.name,
      priority: row.priority,
      responseTime: row.responseTime,
      resolutionTime: row.resolutionTime,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async assertSlaRefs(departmentId?: string | null, categoryId?: string | null) {
    const dept = emptyToNull(departmentId);
    const cat = emptyToNull(categoryId);
    if (dept) {
      const found = await this.prisma.department.findUnique({ where: { id: dept } });
      if (!found) throw new NotFoundException('Department not found');
    }
    if (cat) {
      const found = await this.prisma.category.findUnique({ where: { id: cat } });
      if (!found) throw new NotFoundException('Category not found');
    }
  }
}
