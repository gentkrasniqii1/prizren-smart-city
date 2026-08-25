import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

export type ResolvedSubcategory = {
  subcategoryId: string;
  subcategory: string;
  categoryId: string;
};

/**
 * Resolve an active Subcategory for write paths. Null/empty id → null (wildcard / unset).
 * Enforces: exists, active, and belongs to categoryId when a category is provided.
 */
export async function resolveActiveSubcategory(
  prisma: Pick<PrismaService, 'subcategory'>,
  opts: {
    subcategoryId?: string | null;
    categoryId?: string | null;
  },
): Promise<ResolvedSubcategory | null> {
  const subcategoryId = opts.subcategoryId?.trim() || null;
  if (!subcategoryId) return null;

  const sub = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!sub) throw new NotFoundException('Subcategory not found');
  if (!sub.active) {
    throw new BadRequestException('Subcategory is inactive');
  }
  if (opts.categoryId && opts.categoryId !== sub.categoryId) {
    throw new BadRequestException('Subcategory does not belong to the selected category');
  }

  return {
    subcategoryId: sub.id,
    subcategory: sub.name,
    categoryId: sub.categoryId,
  };
}

/** Normalize a subcategory name for persistence; rejects empty / whitespace-only. */
export function normalizeSubcategoryName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new BadRequestException('Subcategory name is required');
  }
  return name;
}
