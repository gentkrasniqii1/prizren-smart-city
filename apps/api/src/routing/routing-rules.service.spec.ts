import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Priority, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutingRulesService } from './routing-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('RoutingRulesService.resolveRefs via create', () => {
  let prisma: {
    category: { findUnique: ReturnType<typeof vi.fn> };
    department: { findUnique: ReturnType<typeof vi.fn> };
    institution: { findUnique: ReturnType<typeof vi.fn> };
    subcategory: { findUnique: ReturnType<typeof vi.fn> };
    zone: { findUnique: ReturnType<typeof vi.fn> };
    routingRule: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: RoutingRulesService;
  const admin = { id: 'u1', email: 'a@test.local', role: Role.DEPARTMENT_ADMIN };

  const createdRow = {
    id: 'rule-1',
    name: 'Test',
    categoryId: 'cat-a',
    subcategoryId: 'sub-1',
    subcategory: 'Gropa',
    severity: null,
    zoneId: null,
    zone: null,
    isEmergency: null,
    departmentId: null,
    institutionId: null,
    priority: 100,
    slaHours: null,
    defaultPriority: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { name: 'Roads' },
    department: null,
    institution: null,
    zoneRef: null,
  };

  beforeEach(() => {
    prisma = {
      category: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-a' }) },
      department: { findUnique: vi.fn() },
      institution: { findUnique: vi.fn() },
      subcategory: { findUnique: vi.fn() },
      zone: { findUnique: vi.fn() },
      routingRule: {
        create: vi.fn().mockResolvedValue(createdRow),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    service = new RoutingRulesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('accepts valid category + matching subcategory', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: true,
    });
    await service.create(admin, {
      name: 'Test',
      categoryId: 'cat-a',
      subcategoryId: 'sub-1',
    });
    expect(prisma.routingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'cat-a',
          subcategoryId: 'sub-1',
          subcategory: 'Gropa',
        }),
      }),
    );
  });

  it('rejects subcategory belonging to another category', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-b',
      active: true,
    });
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        subcategoryId: 'sub-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects nonexistent subcategory', async () => {
    prisma.subcategory.findUnique.mockResolvedValue(null);
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        subcategoryId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive subcategory', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: false,
    });
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        subcategoryId: 'sub-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves category from subcategory when category omitted', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: true,
    });
    prisma.routingRule.create.mockResolvedValue(createdRow);
    await service.create(admin, {
      name: 'Test',
      subcategoryId: 'sub-1',
    });
    expect(prisma.routingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'cat-a',
          subcategoryId: 'sub-1',
          subcategory: 'Gropa',
        }),
      }),
    );
  });

  it('rejects free-text subcategory without subcategoryId', async () => {
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        subcategory: 'orphan text',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.routingRule.create).not.toHaveBeenCalled();
  });

  it('rejects free-text zone without zoneId', async () => {
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        zone: 'North',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects nonexistent zone', async () => {
    prisma.zone.findUnique.mockResolvedValue(null);
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        zoneId: 'missing-zone',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive zone', async () => {
    prisma.zone.findUnique.mockResolvedValue({
      id: 'zone-1',
      name: 'North',
      active: false,
    });
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        zoneId: 'zone-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('syncs zone name from zoneId', async () => {
    prisma.zone.findUnique.mockResolvedValue({
      id: 'zone-1',
      name: 'North',
      active: true,
    });
    await service.create(admin, {
      name: 'Test',
      categoryId: 'cat-a',
      zoneId: 'zone-1',
      severity: Priority.HIGH,
      isEmergency: true,
    });
    expect(prisma.routingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoneId: 'zone-1',
          zone: 'North',
          severity: Priority.HIGH,
          isEmergency: true,
        }),
      }),
    );
  });

  it('rejects department from wrong institution', async () => {
    prisma.department.findUnique.mockResolvedValue({
      id: 'dept-1',
      institutionId: 'inst-other',
    });
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-a' });
    await expect(
      service.create(admin, {
        name: 'Test',
        categoryId: 'cat-a',
        institutionId: 'inst-a',
        departmentId: 'dept-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects ambiguous conflict with an existing active rule', async () => {
    prisma.department.findUnique.mockResolvedValue({
      id: 'dept-b',
      institutionId: 'inst-a',
    });
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-a' });
    prisma.routingRule.findMany.mockResolvedValue([
      {
        id: 'peer-1',
        name: 'Peer',
        active: true,
        priority: 100,
        categoryId: 'cat-a',
        subcategoryId: null,
        subcategory: null,
        severity: Priority.HIGH,
        zoneId: null,
        zone: null,
        isEmergency: true,
        departmentId: 'dept-a',
        institutionId: 'inst-a',
      },
    ]);
    await expect(
      service.create(admin, {
        name: 'Clash',
        categoryId: 'cat-a',
        severity: Priority.HIGH,
        isEmergency: true,
        departmentId: 'dept-b',
        institutionId: 'inst-a',
        priority: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.routingRule.create).not.toHaveBeenCalled();
  });

  it('allows category-only wildcard rule', async () => {
    prisma.routingRule.create.mockResolvedValue({
      ...createdRow,
      subcategoryId: null,
      subcategory: null,
      defaultPriority: Priority.MEDIUM,
    });
    await service.create(admin, {
      name: 'Wildcard',
      categoryId: 'cat-a',
    });
    expect(prisma.routingRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'cat-a',
          subcategoryId: null,
          subcategory: null,
        }),
      }),
    );
  });
});
