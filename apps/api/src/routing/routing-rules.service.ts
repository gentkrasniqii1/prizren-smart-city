import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import type { RoutingRuleDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { resolveActiveSubcategory } from '../common/subcategory-ref';
import { UpsertRoutingRuleDto } from './dto/upsert-routing-rule.dto';

type RuleRow = {
  id: string;
  name: string;
  categoryId: string | null;
  subcategoryId: string | null;
  subcategory: string | null;
  severity: Priority | null;
  zone: string | null;
  isEmergency: boolean | null;
  departmentId: string | null;
  institutionId: string | null;
  priority: number;
  slaHours: number | null;
  defaultPriority: Priority | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: { name: string } | null;
  department?: { name: string } | null;
  institution?: { name: string } | null;
};

@Injectable()
export class RoutingRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RoutingRuleDto[]> {
    const rows = await this.prisma.routingRule.findMany({
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        institution: { select: { name: true } },
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    user: AuthUser,
    dto: UpsertRoutingRuleDto,
    ip?: string | null,
  ): Promise<RoutingRuleDto> {
    const refs = await this.resolveRefs(dto);
    const created = await this.prisma.routingRule.create({
      data: this.toData(dto, refs),
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        institution: { select: { name: true } },
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'routing_rule.create',
      entityType: 'RoutingRule',
      entityId: created.id,
      ipAddress: ip,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertRoutingRuleDto,
    ip?: string | null,
  ): Promise<RoutingRuleDto> {
    const existing = await this.prisma.routingRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Routing rule not found');
    const refs = await this.resolveRefs(dto);

    const updated = await this.prisma.routingRule.update({
      where: { id },
      data: this.toData(dto, refs),
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
        institution: { select: { name: true } },
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'routing_rule.update',
      entityType: 'RoutingRule',
      entityId: id,
      ipAddress: ip,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.routingRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Routing rule not found');
    await this.prisma.routingRule.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'routing_rule.delete',
      entityType: 'RoutingRule',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private toData(
    dto: UpsertRoutingRuleDto,
    refs: { subcategoryId: string | null; subcategory: string | null; categoryId: string | null },
  ) {
    return {
      name: dto.name.trim(),
      categoryId: refs.categoryId,
      subcategoryId: refs.subcategoryId,
      subcategory: refs.subcategory,
      severity: dto.severity ?? null,
      zone: dto.zone?.trim() || null,
      isEmergency: dto.isEmergency ?? null,
      departmentId: dto.departmentId || null,
      institutionId: dto.institutionId || null,
      priority: dto.priority ?? 100,
      slaHours: dto.slaHours ?? null,
      defaultPriority: dto.defaultPriority ?? null,
      active: dto.active ?? true,
    };
  }

  private async resolveRefs(dto: UpsertRoutingRuleDto): Promise<{
    subcategoryId: string | null;
    subcategory: string | null;
    categoryId: string | null;
  }> {
    let categoryId = dto.categoryId || null;

    if (dto.categoryId) {
      const found = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!found) throw new NotFoundException('Category not found');
    }
    if (dto.departmentId) {
      const found = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!found) throw new NotFoundException('Department not found');
    }
    if (dto.institutionId) {
      const found = await this.prisma.institution.findUnique({ where: { id: dto.institutionId } });
      if (!found) throw new NotFoundException('Institution not found');
    }

    const freeText = dto.subcategory?.trim() || null;
    if (freeText && !dto.subcategoryId) {
      throw new BadRequestException(
        'Free-text subcategory is no longer accepted. Create a Subcategory and pass subcategoryId.',
      );
    }

    const resolved = await resolveActiveSubcategory(this.prisma, {
      subcategoryId: dto.subcategoryId,
      categoryId,
    });
    if (resolved) {
      return {
        subcategoryId: resolved.subcategoryId,
        subcategory: resolved.subcategory,
        categoryId: categoryId ?? resolved.categoryId,
      };
    }

    return {
      subcategoryId: null,
      subcategory: null,
      categoryId,
    };
  }

  private toDto(row: RuleRow): RoutingRuleDto {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      subcategoryId: row.subcategoryId,
      subcategory: row.subcategory,
      severity: row.severity,
      zone: row.zone,
      isEmergency: row.isEmergency,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      institutionId: row.institutionId,
      institutionName: row.institution?.name ?? null,
      priority: row.priority,
      slaHours: row.slaHours,
      defaultPriority: row.defaultPriority,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
