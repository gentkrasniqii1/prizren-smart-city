import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportStatus, Role } from '@prisma/client';
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
