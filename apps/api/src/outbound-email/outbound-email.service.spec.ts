import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OutboundEmailPurpose, OutboundEmailStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboundEmailService } from './outbound-email.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '../auth/config.service';
import { AuditService } from '../audit/audit.service';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';

function reportRow() {
  return {
    id: 'r1',
    publicId: 'PRZ-2026-000001',
    institutionId: 'inst-1',
    description: 'Broken streetlight',
    priority: 'HIGH',
    address: 'Shadërvan',
    lat: 42.21,
    lng: 20.74,
    createdAt: new Date('2026-08-22T10:00:00.000Z'),
    dueAt: new Date('2026-08-24T10:00:00.000Z'),
    photoUrl: 'https://res.cloudinary.com/demo/photo.jpg',
    category: { name: 'Ndriçim publik i prishur' },
    institution: {
      id: 'inst-1',
      name: 'KEDS',
      contact: 'info@keds-energy.com',
      integrationType: 'MANUAL',
      integrationStatus: 'NOT_CONFIGURED',
    },
  };
}

function ledgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mail-1',
    reportId: 'r1',
    institutionId: 'inst-1',
    purpose: OutboundEmailPurpose.INSTITUTION_NEW_CASE,
    recipient: 'info@keds-energy.com',
    subject: 'Raport i ri PRZ-2026-000001 — Prizren Smart City',
    provider: null,
    providerMessageId: null,
    status: OutboundEmailStatus.NOT_CONFIGURED,
    skipReason: 'FLAG_OFF',
    attemptCount: 0,
    maxAttempts: 3,
    lastError: null,
    queuedAt: new Date(),
    sentAt: null,
    acceptedAt: null,
    failedAt: null,
    nextRetryAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    report: { publicId: 'PRZ-2026-000001' },
    institution: { name: 'KEDS' },
    accessTokenId: null,
    accessToken: null,
    ...overrides,
  };
}

describe('OutboundEmailService', () => {
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_ADMIN };
  let prisma: {
    outboundEmail: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    report: { findUnique: ReturnType<typeof vi.fn> };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let mail: { configured: boolean; sendInstitutionalNewCase: ReturnType<typeof vi.fn> };
  let config: { institutionalMailEnabled: boolean; webOrigin: string };
  let audit: { log: ReturnType<typeof vi.fn> };
  let access: { issue: ReturnType<typeof vi.fn>; revokeQuiet: ReturnType<typeof vi.fn> };
  let service: OutboundEmailService;

  beforeEach(() => {
    prisma = {
      outboundEmail: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      user: { findUnique: vi.fn() },
    };
    mail = { configured: true, sendInstitutionalNewCase: vi.fn() };
    config = { institutionalMailEnabled: false, webOrigin: 'http://localhost:3000' };
    audit = { log: vi.fn().mockResolvedValue({}) };
    access = {
      issue: vi.fn().mockResolvedValue({
        id: 'tok-1',
        raw: 'secureRawTokenValue_aaaaaaaaaaaa',
        expiresAt: new Date(),
      }),
      revokeQuiet: vi.fn().mockResolvedValue(undefined),
    };
    service = new OutboundEmailService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      config as unknown as ConfigService,
      audit as unknown as AuditService,
      access as never,
    );
  });

  it('records NOT_CONFIGURED and does not send when the flag is off', async () => {
    const created = ledgerRow();
    prisma.outboundEmail.create.mockResolvedValue(created);

    const dto = await service.enqueueInstitutionNewCase('r1', staff.id);

    expect(mail.sendInstitutionalNewCase).not.toHaveBeenCalled();
    expect(prisma.outboundEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OutboundEmailStatus.NOT_CONFIGURED,
          skipReason: 'FLAG_OFF',
          purpose: OutboundEmailPurpose.INSTITUTION_NEW_CASE,
        }),
      }),
    );
    expect(dto.status).toBe(OutboundEmailStatus.NOT_CONFIGURED);
    expect(audit.log).toHaveBeenCalled();
    expect(access.issue).not.toHaveBeenCalled();
  });

  it('is idempotent for the same report and purpose', async () => {
    prisma.outboundEmail.findUnique.mockResolvedValue(ledgerRow());
    const dto = await service.enqueueInstitutionNewCase('r1', staff.id);
    expect(prisma.outboundEmail.create).not.toHaveBeenCalled();
    expect(mail.sendInstitutionalNewCase).not.toHaveBeenCalled();
    expect(dto.id).toBe('mail-1');
  });

  it('sends when flag, EMAIL integration, ACTIVE status, contact, and provider are set', async () => {
    config.institutionalMailEnabled = true;
    prisma.report.findUnique.mockResolvedValue({
      ...reportRow(),
      institution: {
        id: 'inst-1',
        name: 'KEDS',
        contact: 'info@keds-energy.com',
        integrationType: 'EMAIL',
        integrationStatus: 'ACTIVE',
      },
    });
    prisma.outboundEmail.create.mockResolvedValue(
      ledgerRow({ status: OutboundEmailStatus.QUEUED, skipReason: null }),
    );
    prisma.outboundEmail.update
      .mockResolvedValueOnce(ledgerRow({ status: OutboundEmailStatus.SENDING, skipReason: null }))
      .mockResolvedValueOnce(
        ledgerRow({
          status: OutboundEmailStatus.SENT,
          skipReason: null,
          provider: 'resend',
          sentAt: new Date(),
          attemptCount: 1,
        }),
      );
    mail.sendInstitutionalNewCase.mockResolvedValue({ provider: 'resend', messageId: 're_1' });
    prisma.outboundEmail.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ledgerRow({ status: OutboundEmailStatus.QUEUED, skipReason: null }));

    const dto = await service.enqueueInstitutionNewCase('r1', staff.id);

    expect(mail.sendInstitutionalNewCase).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'info@keds-energy.com',
        publicId: 'PRZ-2026-000001',
        reportUrl: 'http://localhost:3000/institution/reports/secureRawTokenValue_aaaaaaaaaaaa',
      }),
    );
    expect(mail.sendInstitutionalNewCase.mock.calls[0][0].reportUrl).not.toContain('r1');
    expect(access.issue).toHaveBeenCalled();
    expect(mail.sendInstitutionalNewCase.mock.calls[0][0]).not.toHaveProperty('citizenEmail');
    expect(dto.status).toBe(OutboundEmailStatus.SENT);
  });

  it('audits a failed send without storing the recipient in the audit metadata', async () => {
    config.institutionalMailEnabled = true;
    prisma.report.findUnique.mockResolvedValue({
      ...reportRow(),
      institution: {
        id: 'inst-1',
        name: 'KEDS',
        contact: 'info@keds-energy.com',
        integrationType: 'EMAIL',
        integrationStatus: 'ACTIVE',
      },
    });
    prisma.outboundEmail.create.mockResolvedValue(
      ledgerRow({ status: OutboundEmailStatus.QUEUED, skipReason: null }),
    );
    prisma.outboundEmail.update
      .mockResolvedValueOnce(ledgerRow({ status: OutboundEmailStatus.SENDING, skipReason: null }))
      .mockResolvedValueOnce(
        ledgerRow({
          status: OutboundEmailStatus.FAILED,
          skipReason: null,
          attemptCount: 1,
        }),
      );
    prisma.outboundEmail.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ledgerRow({ status: OutboundEmailStatus.QUEUED, skipReason: null }));
    mail.sendInstitutionalNewCase.mockRejectedValue(new Error('provider timeout'));

    const dto = await service.enqueueInstitutionNewCase('r1', staff.id);

    expect(dto.status).toBe(OutboundEmailStatus.FAILED);
    expect(access.revokeQuiet).toHaveBeenCalledWith('tok-1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'outbound_email.failed',
        metadata: expect.objectContaining({ attemptCount: 1, permanent: false }),
      }),
    );
    const failedCall = audit.log.mock.calls.find(
      (call) => (call[0] as { action: string }).action === 'outbound_email.failed',
    );
    expect(JSON.stringify(failedCall?.[0])).not.toContain('info@keds-energy.com');
  });

  it('ignores ASSIGNED transitions that are not the first queue entry', async () => {
    await service.handleStatusChanged(
      new StatusChangedEvent('r1', 'owner', 'RECEIVED' as never, 'ASSIGNED' as never, staff.id),
    );
    expect(prisma.report.findUnique).not.toHaveBeenCalled();
  });

  it('enqueues on first ASSIGNED from moderation', async () => {
    prisma.outboundEmail.create.mockResolvedValue(ledgerRow());
    await service.handleStatusChanged(
      new StatusChangedEvent('r1', 'owner', 'UNDER_REVIEW' as never, 'ASSIGNED' as never, staff.id),
    );
    expect(prisma.outboundEmail.create).toHaveBeenCalled();
    expect(REPORT_STATUS_CHANGED_EVENT).toBe('report.status_changed');
  });

  it('enqueues when approve jumps from SUBMITTED to ASSIGNED', async () => {
    prisma.outboundEmail.create.mockResolvedValue(ledgerRow());
    await service.handleStatusChanged(
      new StatusChangedEvent('r1', 'owner', 'SUBMITTED' as never, 'ASSIGNED' as never, staff.id),
    );
    expect(prisma.outboundEmail.create).toHaveBeenCalled();
  });

  it('retries a failed send when the admin asks', async () => {
    config.institutionalMailEnabled = true;
    prisma.outboundEmail.findUnique.mockResolvedValue(
      ledgerRow({ status: OutboundEmailStatus.FAILED, skipReason: null, attemptCount: 1 }),
    );
    prisma.report.findUnique.mockResolvedValue({
      ...reportRow(),
      institution: {
        id: 'inst-1',
        name: 'KEDS',
        contact: 'info@keds-energy.com',
        integrationType: 'EMAIL',
        integrationStatus: 'ACTIVE',
      },
    });
    prisma.outboundEmail.update
      .mockResolvedValueOnce(ledgerRow({ status: OutboundEmailStatus.SENDING, skipReason: null }))
      .mockResolvedValueOnce(
        ledgerRow({
          status: OutboundEmailStatus.SENT,
          skipReason: null,
          provider: 'resend',
          sentAt: new Date(),
          attemptCount: 2,
        }),
      );
    mail.sendInstitutionalNewCase.mockResolvedValue({ provider: 'resend', messageId: 're_retry' });

    const dto = await service.retry('mail-1', staff as never);
    expect(dto.status).toBe(OutboundEmailStatus.SENT);
    expect(mail.sendInstitutionalNewCase).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound_email.retry' }),
    );
  });

  it('forbids staff from retrying', async () => {
    await expect(
      service.retry('mail-1', {
        id: 's2',
        email: 'st@t.local',
        role: Role.DEPARTMENT_STAFF,
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects retry of a sent message', async () => {
    prisma.outboundEmail.findUnique.mockResolvedValue(
      ledgerRow({ status: OutboundEmailStatus.SENT, skipReason: null }),
    );
    await expect(service.retry('mail-1', staff as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mail.sendInstitutionalNewCase).not.toHaveBeenCalled();
  });
});
