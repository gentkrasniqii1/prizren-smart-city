import { BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingService } from './routing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoutingService.routeByCategory', () => {
  let prisma: { category: { findUnique: ReturnType<typeof vi.fn> } };
  let service: RoutingService;

  beforeEach(() => {
    prisma = { category: { findUnique: vi.fn() } };
    service = new RoutingService(prisma as unknown as PrismaService);
  });

  it('returns null when no categoryId is given', async () => {
    expect(await service.routeByCategory(undefined)).toBeNull();
    expect(await service.routeByCategory(null)).toBeNull();
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an unknown categoryId', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.routeByCategory('missing')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves department, institution, sla and priority from the category', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat-1',
      departmentId: 'dept-1',
      slaHours: 24,
      defaultPriority: Priority.HIGH,
      department: {
        id: 'dept-1',
        institutionId: 'inst-1',
        slaHours: 48,
      },
    });

    const result = await service.routeByCategory('cat-1');

    expect(result).toEqual({
      categoryId: 'cat-1',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
      slaHours: 24,
      defaultPriority: Priority.HIGH,
    });
  });

  it('falls back to the department SLA hours when the category has none', async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: 'cat-1',
      departmentId: 'dept-1',
      slaHours: 0,
      defaultPriority: Priority.MEDIUM,
      department: { id: 'dept-1', institutionId: null, slaHours: 72 },
    });

    const result = await service.routeByCategory('cat-1');

    expect(result?.slaHours).toBe(72);
    expect(result?.institutionId).toBeNull();
  });
});
