import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AdminDataController } from './admin-data.controller';
import { AdminDataService } from './admin-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ADMIN_DATA_BLOCKED_RESOURCES } from '@prizren/shared-types';

describe('AdminDataController roles', () => {
  it('restricts the whole controller to SUPER_ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminDataController)).toEqual([Role.SUPER_ADMIN]);
  });

  it('RolesGuard forbids CITIZEN and allows SUPER_ADMIN', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([Role.SUPER_ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    const citizenCtx = {
      getHandler: () => AdminDataController.prototype.list,
      getClass: () => AdminDataController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'c1', email: 'c@test.local', role: Role.CITIZEN },
        }),
      }),
    };
    expect(() => guard.canActivate(citizenCtx as never)).toThrow(ForbiddenException);

    const staffCtx = {
      ...citizenCtx,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 's1', email: 's@test.local', role: Role.DEPARTMENT_STAFF },
        }),
      }),
    };
    expect(() => guard.canActivate(staffCtx as never)).toThrow(ForbiddenException);

    const superCtx = {
      ...citizenCtx,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'a1', email: 'a@test.local', role: Role.SUPER_ADMIN },
        }),
      }),
    };
    expect(guard.canActivate(superCtx as never)).toBe(true);
  });
});

describe('AdminDataService', () => {
  let prisma: {
    user: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    slaPolicy: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    department: { findUnique: ReturnType<typeof vi.fn> };
    category: { findUnique: ReturnType<typeof vi.fn> };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: AdminDataService;

  const admin = { id: 'sa-1', email: 'sa@test.local', role: Role.SUPER_ADMIN };

  beforeEach(() => {
    prisma = {
      user: { count: vi.fn(), findMany: vi.fn() },
      slaPolicy: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      department: { findUnique: vi.fn() },
      category: { findUnique: vi.fn() },
    };
    audit = { log: vi.fn().mockResolvedValue({ id: 'log-1' }) };
    service = new AdminDataService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('returns the same 404 for blocked secret models and unknown names', () => {
    for (const resource of ADMIN_DATA_BLOCKED_RESOURCES) {
      expect(() => service.assertResource(resource)).toThrow(NotFoundException);
    }
    expect(() => service.assertResource('auth-tokens')).toThrow('Unknown resource');
    expect(() => service.assertResource('refresh-tokens')).toThrow('Unknown resource');
    expect(() => service.assertResource('trusted-devices')).toThrow('Unknown resource');
    expect(() => service.assertResource('oauth-pendings')).toThrow('Unknown resource');
    expect(() => service.assertResource('sequence-counters')).toThrow('Unknown resource');
    expect(() => service.assertResource('password-hashes')).toThrow(NotFoundException);
  });

  it('lists users without selecting or returning passwordHash or totpSecretEnc', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'user@test.local',
        googleId: null,
        facebookId: null,
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        phone: null,
        role: Role.CITIZEN,
        emailVerified: true,
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        totpEnabled: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastLoginIp: '203.0.113.10',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        departments: [],
      },
    ]);

    const page = await service.list('users', { page: 1, limit: 20 });
    const select = prisma.user.findMany.mock.calls[0]?.[0]?.select as Record<string, unknown>;

    expect(select.passwordHash).toBeUndefined();
    expect(select.totpSecretEnc).toBeUndefined();
    expect(select.email).toBe(true);
    expect(select.lastLoginIp).toBe(true);

    const row = page.data[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('passwordHash');
    expect(row).not.toHaveProperty('totpSecretEnc');
    expect(JSON.stringify(row)).not.toMatch(/passwordHash|totpSecretEnc/);
    expect(row.email).toBe('user@test.local');
    expect(row.lastLoginIp).toBe('203.0.113.10');
  });

  it('creates an SLA policy for SUPER_ADMIN and writes an audit log', async () => {
    prisma.slaPolicy.create.mockResolvedValue({
      id: 'sla-1',
      name: 'High roads',
      priority: 'HIGH',
      responseTime: 60,
      resolutionTime: 1440,
      departmentId: null,
      categoryId: null,
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      department: null,
      category: null,
    });

    const row = await service.createSlaPolicy(
      admin,
      {
        name: 'High roads',
        priority: 'HIGH',
        responseTime: 60,
        resolutionTime: 1440,
      },
      '127.0.0.1',
    );

    expect(row.id).toBe('sla-1');
    expect(row.name).toBe('High roads');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: admin.id,
        action: 'sla_policy.create',
        entityType: 'SlaPolicy',
        entityId: 'sla-1',
      }),
    );
  });
});

describe('AdminDataService search where clauses', () => {
  function serviceWith(prisma: Record<string, unknown>) {
    return new AdminDataService(
      prisma as unknown as PrismaService,
      { log: vi.fn() } as unknown as AuditService,
    );
  }

  it('searches departments by name, contact, institution, and id', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ department: { count, findMany } }).list('departments', {
      page: 1,
      limit: 20,
      q: 'Shërbime',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { name: { contains: 'Shërbime', mode: 'insensitive' } },
            { contact: { contains: 'Shërbime', mode: 'insensitive' } },
            { institution: { name: { contains: 'Shërbime', mode: 'insensitive' } } },
            { id: { equals: 'Shërbime' } },
          ]),
        },
      }),
    );
  });

  it('searches categories by name and related department/institution', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ category: { count, findMany } }).list('categories', {
      page: 1,
      limit: 20,
      q: 'Grope',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'Grope', mode: 'insensitive' } },
        { department: { name: { contains: 'Grope', mode: 'insensitive' } } },
      ]),
    );
  });

  it('searches subcategories by name, category name, and ids', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ subcategory: { count, findMany } }).list('subcategories', {
      page: 1,
      limit: 20,
      q: 'Gropa',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'Gropa', mode: 'insensitive' } },
        { category: { name: { contains: 'Gropa', mode: 'insensitive' } } },
        { id: { equals: 'Gropa' } },
        { categoryId: { equals: 'Gropa' } },
      ]),
    );
  });

  it('searches routing rules including subcategory relation', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ routingRule: { count, findMany } }).list('routing-rules', {
      page: 1,
      limit: 20,
      q: 'Eco',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'Eco', mode: 'insensitive' } },
        { subcategory: { contains: 'Eco', mode: 'insensitive' } },
        { subcategoryRef: { name: { contains: 'Eco', mode: 'insensitive' } } },
        { institution: { name: { contains: 'Eco', mode: 'insensitive' } } },
      ]),
    );
  });

  it('searches sla policies by name and related scopes', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ slaPolicy: { count, findMany } }).list('sla-policies', {
      page: 1,
      limit: 20,
      q: 'Kritike',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: 'Kritike', mode: 'insensitive' } },
        { department: { name: { contains: 'Kritike', mode: 'insensitive' } } },
        { category: { name: { contains: 'Kritike', mode: 'insensitive' } } },
      ]),
    );
  });

  it('searches audit logs by action and related user email', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ auditLog: { count, findMany } }).list('audit-logs', {
      page: 1,
      limit: 20,
      q: 'subcategory.create',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { action: { contains: 'subcategory.create', mode: 'insensitive' } },
        { user: { email: { contains: 'subcategory.create', mode: 'insensitive' } } },
      ]),
    );
  });

  it('searches status history by report publicId and note', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    await serviceWith({ statusHistory: { count, findMany } }).list('status-history', {
      page: 1,
      limit: 20,
      q: 'PRZ-2026',
    });
    expect(findMany.mock.calls[0]?.[0]?.where?.OR).toEqual(
      expect.arrayContaining([
        { report: { publicId: { contains: 'PRZ-2026', mode: 'insensitive' } } },
        { note: { contains: 'PRZ-2026', mode: 'insensitive' } },
      ]),
    );
  });
});
