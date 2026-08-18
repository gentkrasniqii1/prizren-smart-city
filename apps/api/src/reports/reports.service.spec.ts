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

    const prisma = {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({
          sequenceCounter: { upsert: sequenceCounterUpsert },
          report: { create: reportCreate },
        }),
      ),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };

    const routing = { routeByCategory: vi.fn().mockResolvedValue(opts.routed) };
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

    return { service, reportCreate, sequenceCounterUpsert };
  }

  it('generates a sequential publicId and persists the routed institutionId', async () => {
    const { service, reportCreate } = buildService({
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
