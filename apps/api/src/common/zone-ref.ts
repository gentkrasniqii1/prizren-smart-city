import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export type ResolvedZone = {
  zoneId: string;
  zone: string;
};

/**
 * Resolve an active Zone for write paths. Null/empty id → null (wildcard / unset).
 * Enforces: exists and active (inactive zones are not routable on new writes).
 */
export async function resolveActiveZone(
  prisma: Pick<PrismaService, 'zone'>,
  zoneId?: string | null,
): Promise<ResolvedZone | null> {
  const id = zoneId?.trim() || null;
  if (!id) return null;

  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) throw new NotFoundException('Zone not found');
  if (!zone.active) {
    throw new BadRequestException('Zone is inactive');
  }

  return { zoneId: zone.id, zone: zone.name };
}

/** Normalize a zone name for persistence; rejects empty / whitespace-only. */
export function normalizeZoneName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new BadRequestException('Zone name is required');
  }
  return name;
}
