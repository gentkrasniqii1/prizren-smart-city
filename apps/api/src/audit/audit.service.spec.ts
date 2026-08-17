import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService.log', () => {
  let prisma: { auditLog: { create: ReturnType<typeof vi.fn> } };
  let service: AuditService;

  beforeEach(() => {
    prisma = { auditLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) } };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('defaults actorType to undefined (DB default USER) when not provided', async () => {
    await service.log({
      userId: 'u1',
      action: 'report.create',
      entityType: 'Report',
      entityId: 'r1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        actorType: undefined,
        action: 'report.create',
        entityType: 'Report',
        entityId: 'r1',
        oldValue: undefined,
        newValue: undefined,
      }),
    });
  });

  it('persists actorType, oldValue, newValue, and userAgent when provided', async () => {
    await service.log({
      userId: 'system',
      actorType: 'SYSTEM',
      action: 'report.status_update',
      entityType: 'Report',
      entityId: 'r1',
      oldValue: { status: 'PENDING' },
      newValue: { status: 'ASSIGNED' },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'SYSTEM',
        oldValue: { status: 'PENDING' },
        newValue: { status: 'ASSIGNED' },
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    });
  });

  it('writes through the provided transaction client when given', async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: 'log-2' });
    const tx = { auditLog: { create: txCreate } };

    await service.log(
      { userId: 'u1', action: 'x', entityType: 'Report', entityId: 'r1' },
      tx as never,
    );

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
