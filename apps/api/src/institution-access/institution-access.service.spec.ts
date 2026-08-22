import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstitutionAccessService } from './institution-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../auth/config.service';
import { AuditService } from '../audit/audit.service';
import { sha256Hex } from '../auth/crypto';

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tok-1',
    tokenHash: sha256Hex('raw-token-value-aaaaaaaaaaaa'),
    reportId: 'r1',
    institutionId: 'inst-1',
    purpose: 'INSTITUTION_NEW_CASE',
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    report: { publicId: 'PRZ-2026-000001' },
    institution: { name: 'KEDS' },
    ...overrides,
  };
}

describe('InstitutionAccessService', () => {
  const admin = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_ADMIN };
  const staffOther = { id: 's2', email: 'o@t.local', role: Role.DEPARTMENT_STAFF };
  const citizen = { id: 'c1', email: 'c@t.local', role: Role.CITIZEN };
  let prisma: {
    institutionAccessToken: {
      updateMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: InstitutionAccessService;

  beforeEach(() => {
    prisma = {
      institutionAccessToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: 'tok-1' }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          departments: [{ institutionId: 'inst-1' }],
        }),
      },
    };
    audit = { log: vi.fn().mockResolvedValue({}) };
    service = new InstitutionAccessService(
      prisma as unknown as PrismaService,
      { institutionAccessTtlDays: 30 } as ConfigService,
      audit as unknown as AuditService,
    );
  });

  it('stores only the hash of a newly issued token', async () => {
    const issued = await service.issue({
      reportId: 'r1',
      institutionId: 'inst-1',
      actorUserId: admin.id,
    });

    expect(issued.raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(issued.raw.length).toBeGreaterThanOrEqual(32);
    const stored = prisma.institutionAccessToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).toBe(sha256Hex(issued.raw));
    expect(stored.tokenHash).not.toBe(issued.raw);
    expect(JSON.stringify(stored)).not.toContain(issued.raw);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'institution_access.issue' }),
    );
  });

  it('revokes previous active tokens for the same report before issuing', async () => {
    await service.issue({ reportId: 'r1', institutionId: 'inst-1', actorUserId: admin.id });
    expect(prisma.institutionAccessToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reportId: 'r1', revokedAt: null }),
      }),
    );
  });

  it('resolves a valid token for staff of that institution', async () => {
    prisma.institutionAccessToken.findUnique.mockResolvedValue(tokenRow());
    const dto = await service.resolve('raw-token-value-aaaaaaaaaaaa', admin as never);
    expect(dto.reportId).toBe('r1');
    expect(dto.publicId).toBe('PRZ-2026-000001');
    expect(prisma.institutionAccessToken.update).toHaveBeenCalled();
  });

  it('rejects expired, revoked, or unknown tokens without leaking the report', async () => {
    prisma.institutionAccessToken.findUnique.mockResolvedValue(null);
    await expect(service.resolve('nope', admin as never)).rejects.toBeInstanceOf(NotFoundException);

    prisma.institutionAccessToken.findUnique.mockResolvedValue(
      tokenRow({ revokedAt: new Date(), reportId: 'secret-report' }),
    );
    await expect(
      service.resolve('raw-token-value-aaaaaaaaaaaa', admin as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.institutionAccessToken.findUnique.mockResolvedValue(
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(
      service.resolve('raw-token-value-aaaaaaaaaaaa', admin as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects staff of another institution and citizens', async () => {
    prisma.institutionAccessToken.findUnique.mockResolvedValue(tokenRow());
    prisma.user.findUnique.mockResolvedValue({ departments: [{ institutionId: 'other' }] });
    await expect(
      service.resolve('raw-token-value-aaaaaaaaaaaa', staffOther as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.resolve('raw-token-value-aaaaaaaaaaaa', citizen as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a super admin resolve without institution membership', async () => {
    prisma.institutionAccessToken.findUnique.mockResolvedValue(tokenRow());
    const dto = await service.resolve('raw-token-value-aaaaaaaaaaaa', {
      id: 'sa',
      email: 'sa@t.local',
      role: Role.SUPER_ADMIN,
    } as never);
    expect(dto.reportId).toBe('r1');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('forbids staff from revoking', async () => {
    await expect(service.revoke('tok-1', staffOther as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
