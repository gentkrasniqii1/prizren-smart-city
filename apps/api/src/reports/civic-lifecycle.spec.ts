import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboundEmailStatus, Priority, ReportStatus, Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AiClassificationService } from '../ai/ai-classification.service';
import { RoutingService } from '../routing/routing.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '../auth/config.service';
import { AuditService } from '../audit/audit.service';
import { OutboundEmailService } from '../outbound-email/outbound-email.service';
import { REPORT_STATUS_CHANGED_EVENT, StatusChangedEvent } from '../events/status-changed.event';

const owner = { id: 'owner-1', email: 'o@t.local', role: Role.CITIZEN };
const stranger = { id: 'c2', email: 'c@t.local', role: Role.CITIZEN };
const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };

function jpegFile(): Express.Multer.File {
  const buffer = Buffer.alloc(32, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return {
    fieldname: 'photo',
    originalname: 'lamp.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    publicId: 'PRZ-2026-000001',
    userId: owner.id,
    categoryId: 'cat-1',
    subcategory: null,
    departmentId: 'dept-1',
    institutionId: 'inst-1',
    description: 'Broken streetlight',
    status: ReportStatus.SUBMITTED,
    priority: Priority.MEDIUM,
    lat: 42.2,
    lng: 20.7,
    address: null,
    photoUrl: 'https://res.cloudinary.com/demo/photo.jpg',
    photoAfterUrl: null,
    aiClassification: null,
    aiConfidence: null,
    duplicateOfId: null,
    isDuplicate: false,
    assignedStaffId: null,
    source: 'WEB',
    anonymous: false,
    language: 'sq',
    dueAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { name: 'Ndriçimi' },
    department: { name: 'Shërbime Publike' },
    institution: { name: 'Komuna e Prizrenit' },
    _count: { votes: 0 },
    statusHistory: [],
    media: [],
    ...overrides,
  };
}

function reportsService(
  prisma: object,
  extras?: { route?: unknown; ai?: unknown; events?: unknown },
) {
  return new ReportsService(
    prisma as unknown as PrismaService,
    {
      uploadImage: vi.fn().mockResolvedValue('https://res.cloudinary.com/demo/photo.jpg'),
    } as unknown as CloudinaryService,
    {
      classifyReportPhoto: extras?.ai ?? vi.fn().mockResolvedValue(null),
    } as unknown as AiClassificationService,
    (extras?.events ?? { emit: vi.fn() }) as unknown as EventEmitter2,
    (extras?.route ?? {
      route: vi.fn().mockResolvedValue({
        categoryId: 'cat-1',
        departmentId: 'dept-1',
        institutionId: 'inst-1',
        slaHours: 48,
        defaultPriority: Priority.HIGH,
        matchedRuleId: 'rule-1',
        matchedRuleName: 'Ndriçimi',
        source: 'rule',
      }),
    }) as unknown as RoutingService,
    { sendReportReceivedEmail: vi.fn().mockResolvedValue(undefined) } as unknown as MailService,
    { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
    { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
  );
}

describe('Phase 10 civic lifecycle', () => {
  it('submit stays hidden, unauthorized actors are blocked, approve routes and queues mail, then the case is public', async () => {
    const reportCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        ...reportRow(),
        ...data,
        status: ReportStatus.SUBMITTED,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        department: null,
        institution: null,
        _count: { votes: 0 },
      }),
    );
    const createPrisma = {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          sequenceCounter: { upsert: vi.fn().mockResolvedValue({ id: 'report-2026', value: 1 }) },
          report: { create: reportCreate, update: vi.fn() },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([]),
      auditLog: { create: vi.fn() },
      report: { findUnique: vi.fn(), update: vi.fn() },
    };
    const created = await reportsService(createPrisma).create(
      owner as never,
      {
        description: 'Broken streetlight near Shadërvan',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-1',
      },
      [],
    );
    expect(created.status).toBe(ReportStatus.SUBMITTED);
    expect(created.publicId).toMatch(/^PRZ-\d{4}-\d{6,}$/);

    await expect(
      reportsService({ report: { findUnique: vi.fn().mockResolvedValue(reportRow()) } }).findOne(
        'r1',
        stranger as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      reportsService({ report: { findUnique: vi.fn() } }).moderate('r1', stranger as never, {
        action: 'approve',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      reportsService({ report: { count: vi.fn(), findMany: vi.fn() } }).listQueue(
        stranger as never,
        {
          lane: 'incoming',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const assigned = reportRow({
      status: ReportStatus.ASSIGNED,
      departmentId: 'dept-1',
      institutionId: 'inst-1',
    });
    const events = { emit: vi.fn() };
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const approved = await new ReportsService(
      {
        report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
        $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
          cb({
            report: { update: vi.fn().mockResolvedValue(assigned) },
            statusHistory: { create: vi.fn() },
          }),
        ),
      } as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      {
        route: vi.fn().mockResolvedValue({
          categoryId: 'cat-1',
          departmentId: 'dept-1',
          institutionId: 'inst-1',
          slaHours: 48,
          defaultPriority: Priority.HIGH,
          matchedRuleId: 'rule-1',
          matchedRuleName: 'Ndriçimi',
          source: 'rule',
        }),
      } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    ).moderate('r1', staff as never, { action: 'approve' });

    expect(approved.status).toBe(ReportStatus.ASSIGNED);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.approve' }),
      expect.anything(),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.queue_enter' }),
      expect.anything(),
    );
    const statusEvent = events.emit.mock.calls.find(
      (call) => call[0] === REPORT_STATUS_CHANGED_EVENT,
    )?.[1] as StatusChangedEvent;
    expect(statusEvent).toMatchObject({
      reportId: 'r1',
      oldStatus: ReportStatus.SUBMITTED,
      newStatus: ReportStatus.ASSIGNED,
    });

    const outboundPrisma = {
      outboundEmail: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'mail-1',
          reportId: 'r1',
          institutionId: 'inst-1',
          purpose: 'INSTITUTION_NEW_CASE',
          recipient: null,
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
          institution: { name: 'Komuna e Prizrenit' },
          accessTokenId: null,
          accessToken: null,
        }),
        update: vi.fn(),
      },
      report: {
        findUnique: vi.fn().mockResolvedValue({
          ...assigned,
          institution: {
            id: 'inst-1',
            name: 'Komuna e Prizrenit',
            contact: null,
            integrationType: 'MANUAL',
            integrationStatus: 'NOT_CONFIGURED',
          },
        }),
      },
    };
    const outboundAudit = { log: vi.fn().mockResolvedValue({}) };
    const outbound = new OutboundEmailService(
      outboundPrisma as unknown as PrismaService,
      { configured: false, sendInstitutionalNewCase: vi.fn() } as unknown as MailService,
      {
        institutionalMailEnabled: false,
        webOrigin: 'http://localhost:3000',
      } as unknown as ConfigService,
      outboundAudit as unknown as AuditService,
      { issue: vi.fn(), revokeQuiet: vi.fn() } as never,
    );
    await outbound.handleStatusChanged(statusEvent);
    expect(outboundPrisma.outboundEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OutboundEmailStatus.NOT_CONFIGURED,
          skipReason: 'FLAG_OFF',
        }),
      }),
    );
    expect(outboundAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'outbound_email.enqueue' }),
    );

    const publicDto = await reportsService({
      report: { findUnique: vi.fn().mockResolvedValue(assigned) },
      vote: { findUnique: vi.fn() },
    }).findOne('PRZ-2026-000001', null);
    expect(publicDto.status).toBe(ReportStatus.ASSIGNED);
    expect(publicDto.publicId).toBe('PRZ-2026-000001');
    expect(publicDto.userId).toBeUndefined();
  });
});

describe('Phase 10 moderation outcomes', () => {
  it('rejects an invalid report and keeps it off the public list', async () => {
    const updated = reportRow({ status: ReportStatus.REJECTED });
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: vi.fn().mockResolvedValue(updated) },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
    };
    const dto = await reportsService(prisma).moderate('r1', staff as never, {
      action: 'reject_invalid',
      note: 'not a civic issue',
    });
    expect(dto.status).toBe(ReportStatus.REJECTED);

    await expect(
      reportsService({ report: { findUnique: vi.fn().mockResolvedValue(updated) } }).findOne(
        'r1',
        null,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a duplicate of another official case without entering the queue', async () => {
    const duplicate = reportRow({
      status: ReportStatus.DUPLICATE,
      duplicateOfId: 'orig-1',
      isDuplicate: true,
    });
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce({ id: 'orig-1', publicId: 'PRZ-2026-000099' })
      .mockResolvedValue(reportRow());
    const prisma = {
      report: {
        findUnique,
        update: vi
          .fn()
          .mockResolvedValue(reportRow({ duplicateOfId: 'orig-1', isDuplicate: true })),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: vi.fn().mockResolvedValue(duplicate) },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
    };
    const route = { route: vi.fn() };
    const dto = await reportsService(prisma, { route }).moderate('r1', staff as never, {
      action: 'mark_duplicate',
      note: 'same lamp',
      duplicateOfId: 'orig-1',
    });
    expect(dto.status).toBe(ReportStatus.DUPLICATE);
    expect(route.route).not.toHaveBeenCalled();
    expect(prisma.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duplicateOfId: 'orig-1', isDuplicate: true }),
      }),
    );
  });

  it('requires duplicateOfId for mark_duplicate', async () => {
    await expect(
      reportsService({ report: { findUnique: vi.fn().mockResolvedValue(reportRow()) } }).moderate(
        'r1',
        staff as never,
        { action: 'mark_duplicate', note: 'dup' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Phase 10 AI remains assistive', () => {
  function createWithAi(classification: {
    category: string;
    severity: string;
    confidence: number;
    summary: string;
    recommendedDepartment: string;
  }) {
    const reportUpdate = vi
      .fn()
      .mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
        reportRow({
          status: (data.status as ReportStatus) ?? ReportStatus.SUBMITTED,
          aiClassification: data.aiClassification,
          aiConfidence: data.aiConfidence,
          categoryId: 'cat-citizen',
        }),
      );
    const reportCreate = vi.fn().mockResolvedValue(
      reportRow({
        categoryId: 'cat-citizen',
        departmentId: null,
        institutionId: null,
        photoUrl: 'https://res.cloudinary.com/demo/photo.jpg',
      }),
    );
    const prisma = {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          sequenceCounter: { upsert: vi.fn().mockResolvedValue({ id: 'report-2026', value: 4 }) },
          report: { create: reportCreate, update: reportUpdate },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([]),
      auditLog: { create: vi.fn() },
      report: { findUnique: vi.fn(), update: reportUpdate },
    };
    const classifyReportPhoto = vi.fn().mockResolvedValue(classification);
    const route = {
      route: vi.fn().mockResolvedValue({
        categoryId: 'cat-citizen',
        departmentId: 'dept-1',
        institutionId: 'inst-1',
        slaHours: 48,
        defaultPriority: Priority.MEDIUM,
        matchedRuleId: 'rule-1',
        matchedRuleName: 'Mbeturina',
        source: 'rule',
      }),
    };
    return { prisma, classifyReportPhoto, route, reportCreate, reportUpdate };
  }

  it('stores a low-confidence suggestion as UNDER_REVIEW without making the case official', async () => {
    const { prisma, classifyReportPhoto, route, reportUpdate } = createWithAi({
      category: 'lighting',
      severity: 'high',
      confidence: 0.41,
      summary: 'possible streetlight',
      recommendedDepartment: 'Shërbime Publike',
    });
    const dto = await reportsService(prisma, { ai: classifyReportPhoto, route }).create(
      owner as never,
      {
        description: 'Dark street',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-citizen',
      },
      [jpegFile()],
    );

    expect(dto.status).not.toBe(ReportStatus.ASSIGNED);
    expect(reportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.UNDER_REVIEW,
          aiConfidence: 0.41,
        }),
      }),
    );
    const updateData = reportUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.categoryId).toBeUndefined();
    expect(updateData.institutionId).toBeUndefined();
  });

  it('does not overwrite the citizen category when AI is confident', async () => {
    const { prisma, classifyReportPhoto, route, reportCreate, reportUpdate } = createWithAi({
      category: 'lighting',
      severity: 'high',
      confidence: 0.92,
      summary: 'streetlight',
      recommendedDepartment: 'Shërbime Publike',
    });
    const dto = await reportsService(prisma, { ai: classifyReportPhoto, route }).create(
      owner as never,
      {
        description: 'Waste pile',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-citizen',
      },
      [jpegFile()],
    );

    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'cat-citizen',
          status: ReportStatus.SUBMITTED,
        }),
      }),
    );
    expect(dto.status).toBe(ReportStatus.SUBMITTED);
    const updateData = reportUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.status).toBe(ReportStatus.SUBMITTED);
    expect(updateData.categoryId).toBeUndefined();
  });

  it('lets staff approve with the official category instead of the AI suggestion', async () => {
    const route = vi.fn().mockResolvedValue({
      categoryId: 'cat-official',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
      slaHours: 24,
      defaultPriority: Priority.HIGH,
      matchedRuleId: 'rule-official',
      matchedRuleName: 'Mbeturina',
      source: 'rule',
    });
    const submitted = reportRow({
      categoryId: 'cat-ai-wrong',
      aiClassification: {
        category: 'lighting',
        severity: 'high',
        confidence: 0.92,
        summary: 'lamp',
        recommendedDepartment: 'Shërbime Publike',
      },
      aiConfidence: 0.92,
    });
    const assigned = reportRow({
      status: ReportStatus.ASSIGNED,
      categoryId: 'cat-official',
    });
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(submitted) },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: vi.fn().mockResolvedValue(assigned) },
          statusHistory: { create: vi.fn() },
        }),
      ),
    };
    const dto = await reportsService(prisma, { route: { route } }).moderate('r1', staff as never, {
      action: 'approve',
      categoryId: 'cat-official',
    });
    expect(route).toHaveBeenCalledWith({ categoryId: 'cat-official', severity: Priority.MEDIUM });
    expect(dto.status).toBe(ReportStatus.ASSIGNED);
    expect(dto.categoryId).toBe('cat-official');
  });
});
