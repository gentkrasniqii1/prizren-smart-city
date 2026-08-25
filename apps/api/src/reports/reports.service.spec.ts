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
import { AuditService } from '../audit/audit.service';

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
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
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
      status: ReportStatus.SUBMITTED,
      photoAfterUrl: null,
      userId: 'owner-1',
      priority: null,
      dueAt: null,
    });
    await expect(
      service.updateStatus('r1', staff as never, { status: ReportStatus.IN_PROGRESS }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects PATCH to ASSIGNED before moderation approve', async () => {
    prisma.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.UNDER_REVIEW,
      photoAfterUrl: null,
      userId: 'owner-1',
      priority: null,
      dueAt: null,
    });
    await expect(
      service.updateStatus('r1', staff as never, { status: ReportStatus.ASSIGNED }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
      status: ReportStatus.RECEIVED,
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
    expect(dto.status).toBe(ReportStatus.RECEIVED);
    expect(events.emit).toHaveBeenCalled();
  });

  it('audits resolve separately from other status updates', async () => {
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const resolveService = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      { routeByCategory: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    );
    prisma.report.findUnique.mockResolvedValue({
      id: 'r1',
      status: ReportStatus.IN_PROGRESS,
      photoAfterUrl: 'https://res.cloudinary.com/demo/after.jpg',
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
      status: ReportStatus.RESOLVED,
      priority: Priority.MEDIUM,
      lat: 42.2,
      lng: 20.7,
      address: null,
      photoUrl: null,
      photoAfterUrl: 'https://res.cloudinary.com/demo/after.jpg',
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
      }),
    );

    const dto = await resolveService.updateStatus('r1', staff as never, {
      status: ReportStatus.RESOLVED,
    });
    expect(dto.status).toBe(ReportStatus.RESOLVED);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.resolve' }),
      expect.anything(),
    );
  });
});

describe('ReportsService.create', () => {
  const citizen = { id: 'citizen-1', email: 'citizen@test.local', role: Role.CITIZEN };
  const currentYear = new Date().getFullYear();

  function buildService(opts: {
    counterValue: number;
    routed: unknown;
    subcategory?: {
      id: string;
      name: string;
      categoryId: string;
      active: boolean;
    } | null;
  }) {
    const reportCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'report-1',
        ...data,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        category: null,
        subcategoryRef: data.subcategoryId ? { name: opts.subcategory?.name ?? null } : null,
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
          auditLog: { create: vi.fn() },
        }),
      ),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      auditLog: { create: vi.fn() },
      subcategory: {
        findUnique: vi.fn().mockResolvedValue(opts.subcategory ?? null),
      },
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
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };

    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      routing as unknown as RoutingService,
      mail as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    );

    return { service, reportCreate, sequenceCounterUpsert, routing, audit, prisma };
  }

  it('generates a sequential publicId and persists the routed institutionId', async () => {
    const { service, reportCreate, routing, audit } = buildService({
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

    expect(routing.route).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      subcategoryId: undefined,
      subcategory: undefined,
    });

    const expectedPublicId = `PRZ-${currentYear}-000008`;
    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicId: expectedPublicId,
          departmentId: 'dept-1',
          institutionId: 'inst-1',
          priority: Priority.HIGH,
          subcategoryId: null,
          subcategory: null,
        }),
      }),
    );
    expect(dto.publicId).toBe(expectedPublicId);
    expect(dto.institutionId).toBe('inst-1');
    expect(dto.subcategoryId).toBeNull();
    expect(dto.status).toBe(ReportStatus.SUBMITTED);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'report.create' }));
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.route',
        metadata: expect.objectContaining({ official: false, institutionId: 'inst-1' }),
      }),
    );
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

  it('persists category + valid subcategory and exposes subcategoryId on the DTO', async () => {
    const { service, reportCreate, routing } = buildService({
      counterValue: 2,
      routed: {
        categoryId: 'cat-1',
        departmentId: 'dept-1',
        institutionId: 'inst-1',
        slaHours: 24,
        defaultPriority: Priority.MEDIUM,
      },
      subcategory: {
        id: 'sub-1',
        name: 'Gropa',
        categoryId: 'cat-1',
        active: true,
      },
    });

    const dto = await service.create(citizen as never, {
      description: 'Deep pothole',
      lat: 42.2,
      lng: 20.7,
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
    });

    expect(routing.route).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      subcategory: 'Gropa',
    });
    expect(reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'cat-1',
          subcategoryId: 'sub-1',
          subcategory: 'Gropa',
        }),
      }),
    );
    expect(dto.subcategoryId).toBe('sub-1');
    expect(dto.subcategory).toBe('Gropa');
  });

  it('rejects subcategory belonging to another category', async () => {
    const { service } = buildService({
      counterValue: 1,
      routed: null,
      subcategory: {
        id: 'sub-1',
        name: 'Gropa',
        categoryId: 'cat-other',
        active: true,
      },
    });

    await expect(
      service.create(citizen as never, {
        description: 'Mismatch',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects nonexistent subcategory', async () => {
    const { service } = buildService({
      counterValue: 1,
      routed: null,
      subcategory: null,
    });

    await expect(
      service.create(citizen as never, {
        description: 'Missing sub',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-1',
        subcategoryId: 'missing',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive subcategory on create', async () => {
    const { service } = buildService({
      counterValue: 1,
      routed: null,
      subcategory: {
        id: 'sub-1',
        name: 'Gropa',
        categoryId: 'cat-1',
        active: false,
      },
    });

    await expect(
      service.create(citizen as never, {
        description: 'Inactive sub',
        lat: 42.2,
        lng: 20.7,
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
      status: ReportStatus.UNDER_REVIEW,
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
          status: ReportStatus.SUBMITTED,
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
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
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
          status: ReportStatus.UNDER_REVIEW,
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalled();
  });
});

describe('ReportsService.addStaffNote', () => {
  it('stores an audit log note', async () => {
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
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
          status: ReportStatus.SUBMITTED,
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
    };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { routeByCategory: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    );

    await service.addStaffNote(
      'r1',
      { id: 'staff-1', email: 's@t.local', role: Role.DEPARTMENT_STAFF },
      { note: '  site visit  ' },
    );

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.note',
        metadata: { note: 'site visit' },
      }),
    );
  });
});

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    publicId: 'PRZ-2026-000001',
    userId: 'owner-1',
    categoryId: null,
    subcategoryId: null,
    subcategory: null,
    departmentId: null,
    institutionId: null,
    description: 'x',
    status: ReportStatus.SUBMITTED,
    priority: null,
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
    source: 'WEB',
    anonymous: false,
    language: 'sq',
    dueAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: null,
    department: null,
    institution: null,
    _count: { votes: 0 },
    statusHistory: [],
    ...overrides,
  };
}

describe('ReportsService public visibility', () => {
  const owner = { id: 'owner-1', email: 'o@t.local', role: Role.CITIZEN };
  const stranger = { id: 'c2', email: 'c@t.local', role: Role.CITIZEN };
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };

  function serviceWith(prisma: object) {
    return new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );
  }

  it('scopes anonymous list queries to public statuses', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      report: { count, findMany },
    };
    await serviceWith(prisma).list({ page: 1, limit: 20 }, null);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining([ReportStatus.ASSIGNED, ReportStatus.RESOLVED]) },
        }),
      }),
    );
  });

  it('does not hide reports from staff lists', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      report: { count, findMany },
    };
    await serviceWith(prisma).list({ page: 1, limit: 20 }, staff as never);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          status: { in: expect.anything() },
        }),
      }),
    );
  });

  it('returns 404 when a stranger opens an unapproved report', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
    };
    await expect(serviceWith(prisma).findOne('r1', stranger as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets the owner open their own unapproved report', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      vote: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const dto = await serviceWith(prisma).findOne('r1', owner as never);
    expect(dto.status).toBe(ReportStatus.SUBMITTED);
    expect(dto.aiClassification).toBeNull();
  });

  it('exposes publicId and a note-free official timeline on the public case DTO', async () => {
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue(
          reportRow({
            status: ReportStatus.ASSIGNED,
            category: { name: 'Ndriçimi' },
            statusHistory: [
              {
                id: 'h1',
                reportId: 'r1',
                oldStatus: ReportStatus.SUBMITTED,
                newStatus: ReportStatus.UNDER_REVIEW,
                changedBy: 'staff-1',
                changedAt: new Date('2026-08-22T10:00:00.000Z'),
                note: 'internal review',
              },
              {
                id: 'h2',
                reportId: 'r1',
                oldStatus: ReportStatus.UNDER_REVIEW,
                newStatus: ReportStatus.ASSIGNED,
                changedBy: 'staff-1',
                changedAt: new Date('2026-08-22T11:00:00.000Z'),
                note: 'approved and routed',
              },
            ],
          }),
        ),
      },
      vote: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const dto = await serviceWith(prisma).findOne('r1', null);
    expect(dto.publicId).toBe('PRZ-2026-000001');
    expect(dto.categoryName).toBe('Ndriçimi');
    expect(dto.userId).toBeUndefined();
    expect(dto.latestNote).toBeNull();
    expect(dto.aiClassification).toBeNull();
    expect(dto.history).toHaveLength(1);
    expect(dto.history?.[0]).toMatchObject({
      newStatus: ReportStatus.ASSIGNED,
      note: null,
      changedBy: undefined,
    });
  });

  it('looks up official cases by publicId', async () => {
    const findUnique = vi.fn().mockResolvedValue(reportRow({ status: ReportStatus.ASSIGNED }));
    const prisma = {
      report: { findUnique },
      vote: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await serviceWith(prisma).findOne('PRZ-2026-000001', null);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicId: 'PRZ-2026-000001' } }),
    );
  });

  it('does not let a stranger comment on an unapproved report', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      comment: { create: vi.fn() },
    };
    await expect(
      serviceWith(prisma).addComment('r1', stranger as never, 'hello'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('lets a stranger comment on an official case and stores the UUID foreign key', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cmt-1',
      reportId: 'r1',
      text: 'hello',
      createdAt: new Date('2026-08-22T12:00:00.000Z'),
      user: { name: 'Citizen' },
    });
    const prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue(reportRow({ status: ReportStatus.ASSIGNED })),
      },
      comment: { create },
    };
    const dto = await serviceWith(prisma).addComment('PRZ-2026-000001', stranger as never, 'hello');
    expect(prisma.report.findUnique).toHaveBeenCalledWith({
      where: { publicId: 'PRZ-2026-000001' },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportId: 'r1', userId: stranger.id, text: 'hello' }),
      }),
    );
    expect(dto.text).toBe('hello');
  });
});

describe('ReportsService.moderate', () => {
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };
  const citizen = { id: 'c1', email: 'c@t.local', role: Role.CITIZEN };

  it('forbids citizens', async () => {
    const service = new ReportsService(
      { report: { findUnique: vi.fn() } } as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );
    await expect(
      service.moderate('r1', citizen as never, { action: 'reject_spam', note: 'joke' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a note for spam rejection', async () => {
    const service = new ReportsService(
      {
        report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      } as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );
    await expect(
      service.moderate('r1', staff as never, { action: 'reject_spam' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects spam with a note and does not enter the institution queue', async () => {
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
    const events = { emit: vi.fn() };
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      { route: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    );

    const dto = await service.moderate('r1', staff as never, {
      action: 'reject_spam',
      note: 'meme photo',
    });
    expect(dto.status).toBe(ReportStatus.REJECTED);
    expect(events.emit).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.moderate',
        metadata: expect.objectContaining({ moderationAction: 'reject_spam' }),
      }),
    );
  });

  it('approves a report with a category into ASSIGNED using RoutingService.route()', async () => {
    const submitted = reportRow({
      categoryId: 'cat-1',
      priority: Priority.HIGH,
    });
    const assigned = reportRow({
      status: ReportStatus.ASSIGNED,
      categoryId: 'cat-1',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
      priority: Priority.HIGH,
      category: { name: 'Ndriçimi' },
      department: { name: 'Shërbimet publike' },
      institution: { name: 'Komuna e Prizrenit' },
    });
    const reportUpdate = vi.fn().mockResolvedValue(assigned);
    const historyCreate = vi.fn();
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(submitted) },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: reportUpdate },
          statusHistory: { create: historyCreate },
        }),
      ),
    };
    const events = { emit: vi.fn() };
    const route = vi.fn().mockResolvedValue({
      categoryId: 'cat-1',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
      slaHours: 48,
      defaultPriority: Priority.HIGH,
      matchedRuleId: 'rule-1',
      matchedRuleName: 'Ndriçimi',
      source: 'rule',
    });
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      events as unknown as EventEmitter2,
      { route } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      audit as unknown as AuditService,
    );

    const dto = await service.moderate('r1', staff as never, { action: 'approve' });

    expect(route).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      severity: Priority.HIGH,
      subcategoryId: null,
      subcategory: null,
    });
    expect(reportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ReportStatus.ASSIGNED,
          departmentId: 'dept-1',
          institutionId: 'inst-1',
          categoryId: 'cat-1',
          priority: Priority.HIGH,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.approve',
        metadata: expect.objectContaining({
          matchedRuleId: 'rule-1',
          source: 'rule',
        }),
      }),
      expect.anything(),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.route' }),
      expect.anything(),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.queue_enter' }),
      expect.anything(),
    );
    expect(dto.status).toBe(ReportStatus.ASSIGNED);
    expect(events.emit).toHaveBeenCalled();
  });

  it('approves UNDER_REVIEW reports into the institution queue', async () => {
    const reviewing = reportRow({
      status: ReportStatus.UNDER_REVIEW,
      categoryId: 'cat-1',
    });
    const assigned = reportRow({
      status: ReportStatus.ASSIGNED,
      categoryId: 'cat-1',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
    });
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reviewing) },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          report: { update: vi.fn().mockResolvedValue(assigned) },
          statusHistory: { create: vi.fn() },
          auditLog: { create: vi.fn() },
        }),
      ),
    };
    const route = vi.fn().mockResolvedValue({
      categoryId: 'cat-1',
      departmentId: 'dept-1',
      institutionId: 'inst-1',
      slaHours: 24,
      defaultPriority: Priority.MEDIUM,
      matchedRuleId: null,
      matchedRuleName: null,
      source: 'category_fallback',
    });
    const dto = await new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    ).moderate('r1', staff as never, { action: 'approve', categoryId: 'cat-1' });

    expect(dto.status).toBe(ReportStatus.ASSIGNED);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('fails closed when there is no category', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow()) },
      $transaction: vi.fn(),
    };
    const route = vi.fn();
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );

    await expect(
      service.moderate('r1', staff as never, { action: 'approve' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(route).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when routing cannot resolve a destination', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow({ categoryId: 'cat-1' })) },
      $transaction: vi.fn(),
    };
    const route = vi.fn().mockResolvedValue({
      categoryId: 'cat-1',
      departmentId: null,
      institutionId: null,
      slaHours: 72,
      defaultPriority: Priority.MEDIUM,
      matchedRuleId: null,
      matchedRuleName: null,
      source: 'unrouted',
    });
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );

    await expect(
      service.moderate('r1', staff as never, { action: 'approve' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(route).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when the category is invalid', async () => {
    const prisma = {
      report: { findUnique: vi.fn().mockResolvedValue(reportRow({ categoryId: 'missing' })) },
      $transaction: vi.fn(),
    };
    const route = vi.fn().mockRejectedValue(new BadRequestException('Invalid categoryId'));
    const service = new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );

    await expect(
      service.moderate('r1', staff as never, { action: 'approve' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('ReportsService.listQueue', () => {
  const staff = { id: 's1', email: 's@t.local', role: Role.DEPARTMENT_STAFF };
  const citizen = { id: 'c1', email: 'c@t.local', role: Role.CITIZEN };

  function serviceWith(prisma: object) {
    return new ReportsService(
      prisma as unknown as PrismaService,
      { uploadImage: vi.fn() } as unknown as CloudinaryService,
      { classifyReportPhoto: vi.fn() } as unknown as AiClassificationService,
      { emit: vi.fn() } as unknown as EventEmitter2,
      { route: vi.fn() } as unknown as RoutingService,
      { sendReportReceivedEmail: vi.fn() } as unknown as MailService,
      { webOrigin: 'http://localhost:3000' } as unknown as ConfigService,
      { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as unknown as AuditService,
    );
  }

  it('forbids citizens', async () => {
    await expect(
      serviceWith({ report: { count: vi.fn(), findMany: vi.fn() } }).listQueue(citizen as never, {
        lane: 'pending',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not department-scope the pending review lane', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValue({ departments: [] });
    await serviceWith({
      report: { count, findMany },
      user: { findUnique },
    }).listQueue(staff as never, { lane: 'pending', page: 1, limit: 20 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW] },
        }),
      }),
    );
    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
    expect(findMany.mock.calls[0][0].where.departmentId).toBeUndefined();
  });

  it('scopes incoming to the staff desk and returns lane counts', async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    const findMany = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValue({
      departments: [{ id: 'd1', institutionId: 'i1' }],
    });
    const result = await serviceWith({
      report: { count, findMany },
      user: { findUnique },
    }).listQueue(staff as never, { lane: 'incoming', page: 1, limit: 20 });

    expect(findUnique).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [ReportStatus.ASSIGNED] },
          OR: expect.any(Array),
        }),
        orderBy: expect.arrayContaining([
          { priority: 'desc' },
          { dueAt: { sort: 'asc', nulls: 'last' } },
        ]),
      }),
    );
    expect(result.meta.laneCounts).toEqual({
      pending: 4,
      incoming: 1,
      active: 0,
      waiting: 0,
      done: 2,
    });
  });
});
