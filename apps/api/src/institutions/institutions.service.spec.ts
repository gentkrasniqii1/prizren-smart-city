import { describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import { InstitutionsService } from './institutions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { evaluateInstitutionalMailPolicy } from '../outbound-email/outbound-policy';

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

describe('InstitutionsService.update + institutional mail policy', () => {
  const admin = { id: 'sa-1', email: 'sa@t.local', role: Role.SUPER_ADMIN };

  it('persists EMAIL + TEST and policy then allows send when flag/provider ready', async () => {
    const existing = institutionRow();
    const updated = {
      ...existing,
      integrationType: 'EMAIL' as const,
      integrationStatus: 'TEST' as const,
    };
    const prisma = {
      institution: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const service = new InstitutionsService(
      prisma as unknown as PrismaService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );

    const dto = await service.update(
      existing.id,
      admin as never,
      {
        name: existing.name,
        type: existing.type,
        phone: existing.phone,
        contact: existing.contact,
        integrationType: 'EMAIL',
        integrationStatus: 'TEST',
        active: true,
      },
      '127.0.0.1',
    );

    expect(prisma.institution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrationType: 'EMAIL',
          integrationStatus: 'TEST',
          contact: 'ops@keds.example',
        }),
      }),
    );
    expect(dto.integrationType).toBe('EMAIL');
    expect(dto.integrationStatus).toBe('TEST');

    const decision = evaluateInstitutionalMailPolicy({
      enabled: true,
      providerConfigured: true,
      institution: {
        contact: dto.contact,
        integrationType: dto.integrationType,
        integrationStatus: dto.integrationStatus,
      },
    });
    expect(decision).toEqual({ send: true, recipient: 'ops@keds.example' });
  });

  it('keeps fail-closed INTEGRATION_STATUS when status stays NOT_CONFIGURED', async () => {
    const existing = institutionRow();
    const updated = {
      ...existing,
      integrationType: 'EMAIL' as const,
      integrationStatus: 'NOT_CONFIGURED' as const,
    };
    const prisma = {
      institution: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
      },
    };
    const service = new InstitutionsService(
      prisma as unknown as PrismaService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );

    const dto = await service.update(
      existing.id,
      admin as never,
      {
        name: existing.name,
        type: existing.type,
        contact: existing.contact,
        integrationType: 'EMAIL',
        integrationStatus: 'NOT_CONFIGURED',
      },
      null,
    );

    const decision = evaluateInstitutionalMailPolicy({
      enabled: true,
      providerConfigured: true,
      institution: {
        contact: dto.contact,
        integrationType: dto.integrationType,
        integrationStatus: dto.integrationStatus,
      },
    });
    expect(decision).toEqual({ send: false, skipReason: 'INTEGRATION_STATUS' });
  });
});
