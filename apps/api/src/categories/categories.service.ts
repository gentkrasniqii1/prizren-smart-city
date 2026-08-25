import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UpsertCategoryDto } from './dto/upsert-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      include: {
        department: {
          select: {
            name: true,
            institutionId: true,
            institution: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(user: AuthUser, dto: UpsertCategoryDto, ip?: string | null): Promise<CategoryDto> {
    await this.assertDepartment(dto.departmentId);
    const created = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        departmentId: dto.departmentId,
        slaHours: dto.slaHours ?? 48,
        defaultPriority: dto.defaultPriority ?? 'MEDIUM',
      },
      include: {
        department: {
          select: {
            name: true,
            institutionId: true,
            institution: { select: { name: true } },
          },
        },
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'category.create',
      entityType: 'Category',
      entityId: created.id,
      ipAddress: ip,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertCategoryDto,
    ip?: string | null,
  ): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    await this.assertDepartment(dto.departmentId);

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        departmentId: dto.departmentId,
        slaHours: dto.slaHours ?? existing.slaHours,
        defaultPriority: dto.defaultPriority ?? existing.defaultPriority,
      },
      include: {
        department: {
          select: {
            name: true,
            institutionId: true,
            institution: { select: { name: true } },
          },
        },
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'category.update',
      entityType: 'Category',
      entityId: id,
      ipAddress: ip,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');

    const [reports, rules, subs] = await Promise.all([
      this.prisma.report.count({ where: { categoryId: id } }),
      this.prisma.routingRule.count({ where: { categoryId: id } }),
      this.prisma.subcategory.count({ where: { categoryId: id } }),
    ]);
    if (reports + rules + subs > 0) {
      throw new ConflictException(
        'Category is in use. Reassign reports, routing rules, and subcategories before deleting.',
      );
    }

    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'category.delete',
      entityType: 'Category',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private async assertDepartment(departmentId: string) {
    const found = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!found) throw new NotFoundException('Department not found');
  }

  private toDto(row: {
    id: string;
    name: string;
    departmentId: string;
    slaHours: number;
    defaultPriority: CategoryDto['defaultPriority'];
    department: {
      name: string;
      institutionId: string | null;
      institution?: { name: string } | null;
    };
  }): CategoryDto {
    return {
      id: row.id,
      name: row.name,
      departmentId: row.departmentId,
      departmentName: row.department.name,
      slaHours: row.slaHours,
      defaultPriority: row.defaultPriority,
      institutionId: row.department.institutionId,
      institutionName: row.department.institution?.name ?? null,
    };
  }
}
