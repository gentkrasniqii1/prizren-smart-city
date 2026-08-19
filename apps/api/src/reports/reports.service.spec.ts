import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Priority, ReportStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { AiClassificationService } from '../ai/ai-classification.service';
import { RoutingService } from '../routing/routing.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '../auth/config.service';

describe('ReportsService.updateStatus', () => {
  let prisma: {
    report: { findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let events: { emit: ReturnType<typeof vi.fn> };
  let service: ReportsService;

  const staff = {
    id: 'staff-1',
    email: 'staff@test.local',
    role: Role.DEPARTMENT_STAFF,
  };

  beforeEach(() => {
    prisma = {
      report: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    };
    events = { emit: vi.fn() };
    service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      { routeByCategory: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
    );
  });

  it('forbids citizens from updating status', async () => {
    await expect(
      service.updateStatus(
        'r1',
        { id: 'c1', email: 'c@t.local', role: Role.CITIZEN },
        { status: ReportStatus.IN_PROGRESS },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when report is missing', async () => {
    prisma.report.findUnique.mockResolvedValue(null);
    await expect(
      service.updateStatus('missing', staff as never, { status: ReportStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires photoAfterUrl before RESOLVED', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.IN_PROGRESS,
      photoAfterUrl: null,
      userId: 'owner-1',
      priority: null,
      dueAt: null,
    });
    await expect(
      service.updateStatus('r1', staff as never, { status: ReportStatus.RESOLVED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an illegal jump that skips the institution queue', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.PENDING,
      photoAfterUrl: null,
      userId: 'owner-1',
      priority: null,
      dueAt: null,
    });
    await expect(
      service.updateStatus('r1', staff as never, { status: ReportStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows institution accept from the queue', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.ASSIGNED,
      photoAfterUrl: null,
      userId: 'owner-1',
      priority: Priority.MEDIUM,
      dueAt: null,
    });
    const updated = {
      id: 'r1',
      publicId: 'PRZ-2026-000001',
      userId: 'owner-1',
      categoryId: null,
      subcategory: null,
      departmentId: 'd1',
      institutionId: 'i1',
      description: 'x',
      status: ReportStatus.ACCEPTED,
      priority: Priority.MEDIUM,
      lat: 42.2,
      lng: 20.7,
      address: null,
      photoUrl: null,
      photoAfterUrl: null,
      aiClassification: null,
      aiConfidence: null,
      duplicateOfId: null,
      isDuplicate: false,
      assignedStaffId: null,
      dueAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
      department: null,
      institution: null,
      _count: { votes: 0 },
      statusHistory: [],
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        report: { update: vi.fn().mockResolvedValue(updated) },
        statusHistory: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    );

    const dto = await service.applyWorkflowAction('r1', staff as never, { action: 'accept' });
    expect(dto.status).toBe(ReportStatus.ACCEPTED);
    expect(events.emit).toHaveBeenCalled();
  });
});

describe('ReportsService.create', () => {
  const citizen = { id: 'citizen-1', email: 'citizen@test.local', role: Role.CITIZEN };
  const currentYear = new Date().getFullYear();

  function buildService(opts: { counterValue: number; routed: unknown }) {
    const reportCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'report-1',
        ...data,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        category: null,
        department: null,
        institution: null,
        _count: { votes: 0 },
      }),
    );
    const sequenceCounterUpsert = vi.fn().mockResolvedValue({
      id: 'report-2026',
      value: opts.counterValue,
    });

    const reportUpdate = vi
      .fn()
      .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const created = (await reportCreate.mock.results.at(-1)?.value) as Record<string, unknown>;
        return { ...created, ...data };
      });

    const prisma = {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          sequenceCounter: { upsert: sequenceCounterUpsert },
          report: { create: reportCreate, update: reportUpdate },
          statusHistory: { create: vi.fn() },
        }),
      ),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      report: {
        findUnique: vi.fn().mockImplementation(async () => {
          const last = reportCreate.mock.results.at(-1)?.value as
            Promise<Record<string, unknown>> | undefined;
          return last ? await last : null;
        }),
      },
    };

    const routing = {
      route: vi.fn().mockImplementation(async (facts: { categoryId?: string }) => {
        if (!facts?.categoryId) return null;
        return opts.routed;
      }),
      routeByCategory: vi.fn().mockResolvedValue(opts.routed),
    };
    const mail = { sendReportReceivedEmail: vi.fn().mockResolvedValue(undefined) };

    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      routing as unknown as RoutingService,
      mail as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
    );

    return { service, reportCreate, sequenceCounterUpsert, routing };
  }

  it('generates a sequential publicId and persists the routed institutionId', async () => {
    const { service, reportCreate, routing } = buildService({
      counterValue: 8,
      routed: {
        categoryId: 'cat-1',
        departmentId: 'dept-1',
        institutionId: 'inst-1',
        slaHours: 24,
        defaultPriority: Priority.HIGH,
      },
    });

    const dto = await service.create(citizen as never, {
      description: 'Pothole on the main road',
      lat: 42.2,
      lng: 20.7,
      categoryId: 'cat-1',
    });

    expect(routing.route).toHaveBeenCalledWith({ categoryId: 'cat-1' });

    const expectedPublicId = `PRZ-${currentYear}-000008`;
    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicId: expectedPublicId,
          departmentId: 'dept-1',
          institutionId: 'inst-1',
          priority: Priority.HIGH,
        }),
      }),
    );
    expect(dto.publicId).toBe(expectedPublicId);
    expect(dto.institutionId).toBe('inst-1');
    expect(dto.status).toBe(ReportStatus.ASSIGNED);
  });

  it('leaves institutionId unset when the category has no routing result', async () => {
    const { service, reportCreate } = buildService({ counterValue: 1, routed: null });

    await service.create(citizen as never, {
      description: 'General complaint about the park',
      lat: 42.2,
      lng: 20.7,
    });

    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicId: `PRZ-${currentYear}-000001`,
          institutionId: undefined,
        }),
      }),
    );
  });
});

describe('ReportsService.escalate', () => {
  const staff = {
    id: 'staff-1',
    email: 'staff@test.local',
    role: Role.DEPARTMENT_STAFF,
  };

  function buildService() {
    const reportRow = {
      id: 'r1',
      publicId: 'PRZ-2026-000001',
      userId: 'owner-1',
      categoryId: null,
      subcategory: null,
      departmentId: null,
      institutionId: null,
      description: 'x',
      status: ReportStatus.IN_REVIEW,
      priority: Priority.HIGH,
      lat: 42.2,
      lng: 20.7,
      address: null,
      photoUrl: null,
      photoAfterUrl: null,
      aiClassification: null,
      aiConfidence: null,
      duplicateOfId: null,
      isDuplicate: false,
      assignedStaffId: null,
      dueAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
      department: null,
      institution: null,
      _count: { votes: 0 },
    };
    const reportUpdate = vi.fn().mockResolvedValue(reportRow);
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          userId: 'owner-1',
          status: ReportStatus.PENDING,
          priority: Priority.MEDIUM,
          dueAt: null,
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: reportUpdate },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
    };
    const events = { emit: vi.fn() };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      { routeByCategory: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
    );
    return { service, reportUpdate, events };
  }

  it('forbids citizens', async () => {
    const { service } = buildService();
    await expect(
      service.escalate('r1', { id: 'c1', email: 'c@t.local', role: Role.CITIZEN }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('raises priority and moves pending to review', async () => {
    const { service, reportUpdate, events } = buildService();
    await service.escalate('r1', staff as never, { note: 'flooding' });
    expect(reportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: Priority.HIGH,
          status: ReportStatus.IN_REVIEW,
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalled();
  });
});

describe('ReportsService.addStaffNote', () => {
  it('stores an audit log note', async () => {
    const auditCreate = vi.fn();
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          publicId: 'PRZ-2026-000001',
          userId: 'owner-1',
          categoryId: null,
          subcategory: null,
          departmentId: null,
          institutionId: null,
          description: 'x',
          status: ReportStatus.PENDING,
          priority: Priority.LOW,
          lat: 42.2,
          lng: 20.7,
          address: null,
          photoUrl: null,
          photoAfterUrl: null,
          aiClassification: null,
          aiConfidence: null,
          duplicateOfId: null,
          isDuplicate: false,
          assignedStaffId: null,
          dueAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: null,
          department: null,
          institution: null,
          _count: { votes: 0 },
        }),
      },
      auditLog: { create: auditCreate },
    };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { routeByCategory: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
    );

    await service.addStaffNote(
      'r1',
      { id: 'staff-1', email: 's@t.local', role: Role.DEPARTMENT_STAFF },
      { note: '  site visit  ' },
    );

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'report.note',
          metadata: { note: 'site visit' },
        }),
      }),
    );
  });
});
