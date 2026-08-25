import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubcategoriesService } from './subcategories.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('SubcategoriesService', () => {
  let prisma: {
    category: { findUnique: ReturnType<typeof vi.fn> };
    subcategory: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    report: { count: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
    routingRule: { count: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: SubcategoriesService;
  const admin = { id: 'u1', email: 'a@test.local', role: Role.SUPER_ADMIN };

  beforeEach(() => {
    prisma = {
      category: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-a' }) },
      subcategory: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      report: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn() },
      routingRule: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn() },
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    service = new SubcategoriesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  it('creates a valid subcategory', async () => {
    prisma.subcategory.create.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      category: { name: 'Roads' },
    });
    const row = await service.create(admin, { name: '  Gropa  ', categoryId: 'cat-a' });
    expect(row.name).toBe('Gropa');
    expect(prisma.subcategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Gropa', categoryId: 'cat-a' }),
      }),
    );
  });

  it('rejects empty name', async () => {
    await expect(service.create(admin, { name: '', categoryId: 'cat-a' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects whitespace-only name', async () => {
    await expect(
      service.create(admin, { name: '   ', categoryId: 'cat-a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps duplicate name under same category to conflict', async () => {
    const { Prisma } = await import('@prisma/client');
    prisma.subcategory.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create(admin, { name: 'Gropa', categoryId: 'cat-a' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows same name under a different category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-b' });
    prisma.subcategory.create.mockResolvedValue({
      id: 'sub-2',
      name: 'Gropa',
      categoryId: 'cat-b',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { name: 'Other' },
    });
    const row = await service.create(admin, { name: 'Gropa', categoryId: 'cat-b' });
    expect(row.categoryId).toBe('cat-b');
  });

  it('rejects moving category while referenced by reports/rules', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: true,
    });
    prisma.report.count.mockResolvedValue(1);
    prisma.routingRule.count.mockResolvedValue(0);
    await expect(
      service.update('sub-1', admin, { name: 'Gropa', categoryId: 'cat-b' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.subcategory.update).not.toHaveBeenCalled();
  });

  it('updates when category move is unreferenced', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-a',
      active: true,
    });
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-b' });
    prisma.subcategory.update.mockResolvedValue({
      id: 'sub-1',
      name: 'Gropa',
      categoryId: 'cat-b',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { name: 'Other' },
    });
    const row = await service.update('sub-1', admin, { name: 'Gropa', categoryId: 'cat-b' });
    expect(row.categoryId).toBe('cat-b');
  });

  it('rejects delete when referenced', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({ id: 'sub-1' });
    prisma.report.count.mockResolvedValue(0);
    prisma.routingRule.count.mockResolvedValue(2);
    await expect(service.remove('sub-1', admin)).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes unreferenced subcategory', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({ id: 'sub-1' });
    prisma.report.count.mockResolvedValue(0);
    prisma.routingRule.count.mockResolvedValue(0);
    await expect(service.remove('sub-1', admin)).resolves.toEqual({ ok: true });
    expect(prisma.subcategory.delete).toHaveBeenCalled();
  });

  it('throws not found for missing category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      service.create(admin, { name: 'Gropa', categoryId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
