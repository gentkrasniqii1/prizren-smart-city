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
      oldValue: { status: 'SUBMITTED' },
      newValue: { status: 'ASSIGNED' },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'SYSTEM',
        oldValue: { status: 'SUBMITTED' },
        newValue: { status: 'ASSIGNED' },
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      }),
    });
  });

  it('emits a structured log and redacts secret metadata', async () => {
    const log = vi.fn();
    (service as unknown as { logger: { log: ReturnType<typeof vi.fn> } }).logger = { log };

    await service.log({
      userId: 'u1',
      action: 'report.create',
      entityType: 'Report',
      entityId: 'r1',
      metadata: {
        publicId: 'PRZ-2026-000001',
        jwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.sig',
      },
    });

    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      event: string;
      metadata: { publicId: string; jwt: string };
    };
    expect(payload.event).toBe('report.create');
    expect(payload.metadata.publicId).toBe('PRZ-2026-000001');
    expect(payload.metadata.jwt).toBe('[redacted]');
  });

  it('keeps notes in the audit row but omits them from the process log', async () => {
    const log = vi.fn();
    (service as unknown as { logger: { log: ReturnType<typeof vi.fn> } }).logger = { log };

    await service.log({
      userId: 'u1',
      action: 'report.note',
      entityType: 'Report',
      entityId: 'r1',
      metadata: { note: 'site visit details' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { note: 'site visit details' },
      }),
    });
    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      metadata: Record<string, unknown>;
    };
    expect(payload.metadata).not.toHaveProperty('note');
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
