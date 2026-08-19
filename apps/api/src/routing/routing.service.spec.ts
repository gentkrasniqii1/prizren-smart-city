import { BadRequestException } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingService } from './routing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoutingService.route', () => {
  let prisma: {
    category: { findUnique: ReturnType<typeof vi.fn> };
    routingRule: { findMany: ReturnType<typeof vi.fn> };
    department: { findUnique: ReturnType<typeof vi.fn> };
    institution: { findUnique: ReturnType<typeof vi.fn> };
  };
  let service: RoutingService;

  const category = {
    id: 'cat-waste',
    name: 'Mbeturina',
    departmentId: 'dept-fallback',
    slaHours: 72,
    defaultPriority: Priority.LOW,
    department: {
      id: 'dept-fallback',
      institutionId: 'inst-komuna',
      slaHours: 96,
      institution: { id: 'inst-komuna', name: 'Komuna e Prizrenit' },
    },
  };

  beforeEach(() => {
    prisma = {
      category: { findUnique: vi.fn() },
      routingRule: { findMany: vi.fn() },
      department: { findUnique: vi.fn() },
      institution: { findUnique: vi.fn() },
    };
    service = new RoutingService(prisma as unknown as PrismaService);
  });

  it('returns null when no categoryId is given', async () => {
    expect(await service.routeByCategory(undefined)).toBeNull();
    expect(await service.routeByCategory(null)).toBeNull();
    expect(prisma.category.findUnique).not.toHaveBeenCalled();
  });

  it('throws for an unknown categoryId', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.routeByCategory('missing')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses a matching routing rule over the category fallback department', async () => {
    prisma.category.findUnique.mockResolvedValue(category);
    prisma.routingRule.findMany.mockResolvedValue([
      {
        id: 'rule-eco',
        name: 'Mbeturina → Eco Regjioni',
        categoryId: 'cat-waste',
        subcategory: null,
        severity: null,
        zone: null,
        isEmergency: null,
        departmentId: 'dept-waste',
        institutionId: 'inst-eco',
        priority: 40,
        slaHours: 48,
        defaultPriority: Priority.MEDIUM,
        active: true,
        createdAt: new Date(),
        department: {
          id: 'dept-waste',
          institutionId: 'inst-eco',
          slaHours: 48,
          institution: { id: 'inst-eco', name: 'Eco Regjioni' },
        },
        institution: { id: 'inst-eco', name: 'Eco Regjioni' },
      },
    ]);

    const result = await service.routeByCategory('cat-waste');

    expect(result).toMatchObject({
      categoryId: 'cat-waste',
      departmentId: 'dept-waste',
      institutionId: 'inst-eco',
      slaHours: 48,
      defaultPriority: Priority.MEDIUM,
      matchedRuleId: 'rule-eco',
      source: 'rule',
    });
  });

  it('falls back to the category department when no rule matches', async () => {
    prisma.category.findUnique.mockResolvedValue(category);
    prisma.routingRule.findMany.mockResolvedValue([
      {
        id: 'rule-other',
        name: 'Other',
        categoryId: 'cat-other',
        subcategory: null,
        severity: null,
        zone: null,
        isEmergency: null,
        departmentId: 'dept-x',
        institutionId: 'inst-x',
        priority: 10,
        slaHours: 24,
        defaultPriority: Priority.HIGH,
        active: true,
        createdAt: new Date(),
        department: null,
        institution: null,
      },
    ]);

    const result = await service.routeByCategory('cat-waste');

    expect(result).toMatchObject({
      departmentId: 'dept-fallback',
      institutionId: 'inst-komuna',
      slaHours: 72,
      defaultPriority: Priority.LOW,
      matchedRuleId: null,
      source: 'category_fallback',
    });
  });

  it('treats a CRITICAL category as emergency so fire/police rules can match', async () => {
    const fireCategory = {
      id: 'cat-fire',
      name: 'Zjarr / emergjencë',
      departmentId: 'dept-fire',
      slaHours: 4,
      defaultPriority: Priority.CRITICAL,
      department: {
        id: 'dept-fire',
        institutionId: 'inst-fire',
        slaHours: 4,
        institution: { id: 'inst-fire', name: 'Fire & Rescue' },
      },
    };
    prisma.category.findUnique.mockResolvedValue(fireCategory);
    prisma.routingRule.findMany.mockResolvedValue([
      {
        id: 'rule-fire',
        name: 'Fire emergency',
        categoryId: 'cat-fire',
        subcategory: null,
        severity: null,
        zone: null,
        isEmergency: true,
        departmentId: 'dept-fire',
        institutionId: 'inst-fire',
        priority: 10,
        slaHours: 4,
        defaultPriority: Priority.CRITICAL,
        active: true,
        createdAt: new Date(),
        department: fireCategory.department,
        institution: { id: 'inst-fire', name: 'Fire & Rescue' },
      },
    ]);

    const result = await service.route({ categoryId: 'cat-fire' });

    expect(result).toMatchObject({
      departmentId: 'dept-fire',
      institutionId: 'inst-fire',
      matchedRuleId: 'rule-fire',
      source: 'rule',
      slaHours: 4,
    });
  });
});
