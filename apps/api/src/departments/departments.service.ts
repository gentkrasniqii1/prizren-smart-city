import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { DepartmentDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UpsertDepartmentDto } from './dto/upsert-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<DepartmentDto[]> {
    const rows = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { institution: { select: { name: true } } },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    user: AuthUser,
    dto: UpsertDepartmentDto,
    ip?: string | null,
  ): Promise<DepartmentDto> {
    await this.assertInstitution(dto.institutionId);
    const created = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        contact: dto.contact?.trim() || null,
        slaHours: dto.slaHours ?? 48,
        institutionId: dto.institutionId || null,
      },
      include: { institution: { select: { name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'department.create',
      entityType: 'Department',
      entityId: created.id,
      ipAddress: ip,
      newValue: this.toDto(created) as never,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertDepartmentDto,
    ip?: string | null,
  ): Promise<DepartmentDto> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    await this.assertInstitution(dto.institutionId);

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        contact: dto.contact?.trim() || null,
        slaHours: dto.slaHours ?? existing.slaHours,
        institutionId: dto.institutionId === undefined ? existing.institutionId : dto.institutionId,
      },
      include: { institution: { select: { name: true } } },
    });
    await this.audit.log({
      userId: user.id,
      action: 'department.update',
      entityType: 'Department',
      entityId: id,
      ipAddress: ip,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');

    const [reports, categories, rules] = await Promise.all([
      this.prisma.report.count({ where: { departmentId: id } }),
      this.prisma.category.count({ where: { departmentId: id } }),
      this.prisma.routingRule.count({ where: { departmentId: id } }),
    ]);
    if (reports + categories + rules > 0) {
      throw new ConflictException(
        'Department is in use. Reassign categories, reports, and routing rules before deleting.',
      );
    }

    await this.prisma.department.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'department.delete',
      entityType: 'Department',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private async assertInstitution(institutionId?: string | null) {
    if (!institutionId) return;
    const found = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!found) throw new NotFoundException('Institution not found');
  }

  private toDto(row: {
    id: string;
    name: string;
    contact: string | null;
    slaHours: number;
    institutionId: string | null;
    institution?: { name: string } | null;
  }): DepartmentDto {
    return {
      id: row.id,
      name: row.name,
      contact: row.contact,
      slaHours: row.slaHours,
      institutionId: row.institutionId,
      institutionName: row.institution?.name ?? null,
    };
  }
}
