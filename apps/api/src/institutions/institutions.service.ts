import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InstitutionDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { slugify } from '../common/slug';
import { UpsertInstitutionDto } from './dto/upsert-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(includeInactive = false): Promise<InstitutionDto[]> {
    const rows = await this.prisma.institution.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(
    user: AuthUser,
    dto: UpsertInstitutionDto,
    ip?: string | null,
  ): Promise<InstitutionDto> {
    const slug = await this.uniqueSlug(dto.slug?.trim() || slugify(dto.name));
    const created = await this.prisma.institution.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: dto.type.trim(),
        contact: dto.contact?.trim() || null,
        active: dto.active ?? true,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'institution.create',
      entityType: 'Institution',
      entityId: created.id,
      ipAddress: ip,
      newValue: this.toDto(created) as never,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertInstitutionDto,
    ip?: string | null,
  ): Promise<InstitutionDto> {
    const existing = await this.prisma.institution.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Institution not found');

    let slug = existing.slug;
    if (dto.slug && dto.slug.trim() !== existing.slug) {
      slug = await this.uniqueSlug(dto.slug.trim(), id);
    }

    const updated = await this.prisma.institution.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        slug,
        type: dto.type.trim(),
        contact: dto.contact?.trim() || null,
        active: dto.active ?? existing.active,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'institution.update',
      entityType: 'Institution',
      entityId: id,
      ipAddress: ip,
      oldValue: this.toDto(existing) as never,
      newValue: this.toDto(updated) as never,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.institution.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Institution not found');

    const [reports, departments, rules] = await Promise.all([
      this.prisma.report.count({ where: { institutionId: id } }),
      this.prisma.department.count({ where: { institutionId: id } }),
      this.prisma.routingRule.count({ where: { institutionId: id } }),
    ]);
    if (reports + departments + rules > 0) {
      throw new ConflictException(
        'Institution is in use. Deactivate it instead of deleting, or reassign reports, departments, and rules first.',
      );
    }

    await this.prisma.institution.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'institution.delete',
      entityType: 'Institution',
      entityId: id,
      ipAddress: ip,
      oldValue: this.toDto(existing) as never,
    });
    return { ok: true };
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = slugify(base);
    let n = 2;
    while (
      await this.prisma.institution.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      })
    ) {
      candidate = `${slugify(base)}-${n}`;
      n += 1;
    }
    return candidate;
  }

  private toDto(row: {
    id: string;
    name: string;
    slug: string;
    type: string;
    contact: string | null;
    active: boolean;
    integrationType: InstitutionDto['integrationType'];
    integrationStatus: InstitutionDto['integrationStatus'];
    createdAt: Date;
  }): InstitutionDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      contact: row.contact,
      active: row.active,
      integrationType: row.integrationType,
      integrationStatus: row.integrationStatus,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
