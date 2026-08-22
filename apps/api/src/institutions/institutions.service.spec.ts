import { describe, expect, it, vi } from 'vitest';
import { InstitutionsService } from './institutions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function institutionRow() {
  return {
    id: 'inst-1',
    name: 'KEDS',
    slug: 'keds',
    type: 'UTILITY',
    phone: '0800-123',
    contact: 'ops@keds.example',
    active: true,
    integrationType: 'MANUAL' as const,
    integrationStatus: 'NOT_CONFIGURED' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('InstitutionsService.list', () => {
  it('strips contact from the public DTO and keeps it for staff', async () => {
    const prisma = {
      institution: { findMany: vi.fn().mockResolvedValue([institutionRow()]) },
    };
    const service = new InstitutionsService(
      prisma as unknown as PrismaService,
      { log: vi.fn() } as unknown as AuditService,
    );

    const publicList = await service.list(false, false);
    expect(publicList[0].contact).toBeNull();
    expect(publicList[0].phone).toBe('0800-123');
    expect(publicList[0].name).toBe('KEDS');

    const staffList = await service.list(false, true);
    expect(staffList[0].contact).toBe('ops@keds.example');
  });
});
