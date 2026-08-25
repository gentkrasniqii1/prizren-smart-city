import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ZoneDto } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { normalizeZoneName } from '../common/zone-ref';
import { UpsertZoneDto } from './dto/upsert-zone.dto';

@Injectable()
export class ZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts?: { includeInactive?: boolean; q?: string }): Promise<ZoneDto[]> {
    const q = opts?.q?.trim();
    const rows = await this.prisma.zone.findMany({
      where: {
        ...(opts?.includeInactive ? {} : { active: true }),
        ...(q
          ? {
              OR: [{ name: { contains: q, mode: 'insensitive' } }, { id: { equals: q } }],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async create(user: AuthUser, dto: UpsertZoneDto, ip?: string | null): Promise<ZoneDto> {
    const name = normalizeZoneName(dto.name);
    let created;
    try {
      created = await this.prisma.zone.create({
        data: {
          name,
          active: dto.active ?? true,
        },
      });
    } catch (err) {
      this.rethrowUnique(err);
    }
    await this.audit.log({
      userId: user.id,
      action: 'zone.create',
      entityType: 'Zone',
      entityId: created.id,
      ipAddress: ip,
    });
    return this.toDto(created);
  }

  async update(
    id: string,
    user: AuthUser,
    dto: UpsertZoneDto,
    ip?: string | null,
  ): Promise<ZoneDto> {
    const existing = await this.prisma.zone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zone not found');
    const name = normalizeZoneName(dto.name);

    let updated;
    try {
      updated = await this.prisma.zone.update({
        where: { id },
        data: {
          name,
          active: dto.active ?? existing.active,
        },
      });
    } catch (err) {
      this.rethrowUnique(err);
    }

    if (updated.name !== existing.name) {
      await this.prisma.routingRule.updateMany({
        where: { zoneId: id },
        data: { zone: updated.name },
      });
    }

    await this.audit.log({
      userId: user.id,
      action: 'zone.update',
      entityType: 'Zone',
      entityId: id,
      ipAddress: ip,
    });
    return this.toDto(updated);
  }

  async remove(id: string, user: AuthUser, ip?: string | null): Promise<{ ok: true }> {
    const existing = await this.prisma.zone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Zone not found');

    const [reports, rules] = await Promise.all([
      this.prisma.report.count({ where: { zoneId: id } }),
      this.prisma.routingRule.count({ where: { zoneId: id } }),
    ]);
    if (reports + rules > 0) {
      throw new ConflictException(
        'Zone is in use. Reassign reports and routing rules before deleting.',
      );
    }

    await this.prisma.zone.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      action: 'zone.delete',
      entityType: 'Zone',
      entityId: id,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private rethrowUnique(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('A zone with this name already exists.');
    }
    throw err;
  }

  private toDto(row: {
    id: string;
    name: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ZoneDto {
    return {
      id: row.id,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
