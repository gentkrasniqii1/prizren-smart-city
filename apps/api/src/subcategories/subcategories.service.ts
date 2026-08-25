import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SubcategoryDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { normalizeSubcategoryName } from '../common/subcategory-ref';
import { UpsertSubcategoryDto } from './dto/upsert-subcategory.dto';

@Injectable()
export class SubcategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts?: {
    categoryId?: string;
    includeInactive?: boolean;
    q?: string;
  }): Promise<SubcategoryDto[]> {
    const q = opts?.q?.trim();
    const rows = await this.prisma.subcategory.findMany({
      where: {
        ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts?.includeInactive ? {} : { active: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { category: { name: { contains: q, mode: 'insensitive' } } },
                { id: { equals: q } },
                { categoryId: { equals: q } },
              ],
            }
          : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    user: AuthUser,
    dto: UpsertSubcategoryDto,
    ip?: string | null,
  ): Promise<SubcategoryDto> {
    const name = normalizeSubcategoryName(dto.name);
    await this.assertCategory(dto.categoryId);
    let created;
    try {
      created = await this.prisma.subcategory.create({
        data: {
          name,
          categoryId: dto.categoryId,
          active: dto.active ?? true,
        },
        include: { category: { select: { name: true } } },
      });
    } catch (err) {
      this.rethrowUnique(err);
    }
    await this.audit.log({
      userId: user.id,
      action: 'subcategory.create',
      entityType: 'Subcategory',
      entityId: created.id,
      ipAddress: ip,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertSubcategoryDto,
    ip?: string | null,
  ): Promise<SubcategoryDto> {
    const existing = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subcategory not found');
    const name = normalizeSubcategoryName(dto.name);
    await this.assertCategory(dto.categoryId);

    if (dto.categoryId !== existing.categoryId) {
      const [reports, rules] = await Promise.all([
        this.prisma.report.count({ where: { subcategoryId: id } }),
        this.prisma.routingRule.count({ where: { subcategoryId: id } }),
      ]);
      if (reports + rules > 0) {
        throw new ConflictException(
          'Cannot move this subcategory because it is already referenced by existing routing rules or reports.',
        );
      }
    }

    let updated;
    try {
      updated = await this.prisma.subcategory.update({
        where: { id },
        data: {
          name,
          categoryId: dto.categoryId,
          active: dto.active ?? existing.active,
        },
        include: { category: { select: { name: true } } },
      });
    } catch (err) {
      this.rethrowUnique(err);
    }

    if (updated.name !== existing.name) {
      await Promise.all([
        this.prisma.routingRule.updateMany({
          where: { subcategoryId: id },
          data: { subcategory: updated.name },
        }),
        this.prisma.report.updateMany({
          where: { subcategoryId: id },
          data: { subcategory: updated.name },
        }),
      ]);
    }

    await this.audit.log({
      userId: user.id,
      action: 'subcategory.update',
      entityType: 'Subcategory',
      entityId: id,
      ipAddress: ip,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.subcategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subcategory not found');

    const [reports, rules] = await Promise.all([
      this.prisma.report.count({ where: { subcategoryId: id } }),
      this.prisma.routingRule.count({ where: { subcategoryId: id } }),
    ]);
    if (reports + rules > 0) {
      throw new ConflictException(
        'Subcategory is in use. Reassign reports and routing rules before deleting.',
      );
    }

    await this.prisma.subcategory.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'subcategory.delete',
      entityType: 'Subcategory',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private async assertCategory(categoryId: string) {
    const found = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!found) throw new NotFoundException('Category not found');
  }

  private rethrowUnique(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('A subcategory with this name already exists in the category.');
    }
    throw err;
  }

  private toDto(row: {
    id: string;
    name: string;
    categoryId: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    category: { name: string };
  }): SubcategoryDto {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
