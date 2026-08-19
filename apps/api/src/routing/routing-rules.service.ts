import { Injectable, NotFoundException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import type { RoutingRuleDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UpsertRoutingRuleDto } from './dto/upsert-routing-rule.dto';

type RuleRow = {
  id: string;
  name: string;
  categoryId: string | null;
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
    await this.assertRefs(dto);
    const created = await this.prisma.routingRule.create({
      data: this.toData(dto),
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
    await this.assertRefs(dto);

    const updated = await this.prisma.routingRule.update({
      where: { id },
      data: this.toData(dto),
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

  private toData(dto: UpsertRoutingRuleDto) {
    return {
      name: dto.name.trim(),
      categoryId: dto.categoryId || null,
      subcategory: dto.subcategory?.trim() || null,
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

  private async assertRefs(dto: UpsertRoutingRuleDto) {
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
  }

  private toDto(row: RuleRow): RoutingRuleDto {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
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
