import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InstitutionAccessPurpose, ReportStatus, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportPdfService } from './report-pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../auth/config.service';
import { InstitutionAccessService } from '../institution-access/institution-access.service';

describe('ReportPdfService', () => {
  const staff = { id: 's1', email: 'staff@test.local', role: Role.DEPARTMENT_ADMIN };
  const citizen = { id: 'c1', email: 'citizen@test.local', role: Role.CITIZEN };
  let prisma: { report: { findUnique: ReturnType<typeof vi.fn> } };
  let access: { issue: ReturnType<typeof vi.fn> };
  let service: ReportPdfService;

  beforeEach(() => {
    prisma = {
      report: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          publicId: 'PRZ-2026-000042',
          description: 'Broken lamp at Shadërvan',
          status: ReportStatus.ASSIGNED,
          priority: 'HIGH',
          lat: 42.21,
          lng: 20.74,
          address: 'Shadërvan',
          photoUrl: null,
          photoAfterUrl: null,
          institutionId: 'inst-1',
          dueAt: null,
          createdAt: new Date('2026-08-22T10:00:00Z'),
          category: { name: 'Ndriçim publik i prishur' },
          department: { name: 'Drejtoria e Shërbimeve Publike' },
          institution: { name: 'KEDS' },
          media: [],
          statusHistory: [
            {
              newStatus: ReportStatus.ASSIGNED,
              changedAt: new Date('2026-08-22T12:00:00Z'),
            },
          ],
        }),
      },
    };
    access = {
      issue: vi.fn().mockResolvedValue({
        id: 'tok-pdf',
        raw: 'pdfRawTokenValue_aaaaaaaaaaaa',
        expiresAt: new Date(),
      }),
    };
    service = new ReportPdfService(
      prisma as unknown as PrismaService,
      { webOrigin: 'http://localhost:3000' } as ConfigService,
      access as unknown as InstitutionAccessService,
    );
  });

  it('forbids citizens and unapproved cases', async () => {
    await expect(service.buildOfficialPdf('r1', citizen as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.report.findUnique.mockResolvedValueOnce({
      id: 'r1',
      status: ReportStatus.SUBMITTED,
      statusHistory: [],
      media: [],
      photoUrl: null,
      photoAfterUrl: null,
    });
    await expect(service.buildOfficialPdf('r1', staff as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('builds a PDF without citizen identity and with a secure institution link', async () => {
    const { buffer, filename } = await service.buildOfficialPdf('r1', staff as never);
    expect(filename).toBe('PRZ-2026-000042.pdf');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const text = buffer.toString('latin1');
    expect(text).toContain(Buffer.from('PRZ-2026-000042').toString('hex'));
    expect(text).toContain('/institution/reports/');
    expect(text).not.toContain('citizen@');
    expect(text).not.toContain('staff@test.local');
    expect(access.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: InstitutionAccessPurpose.INSTITUTION_CASE_PDF,
        reportId: 'r1',
      }),
    );
  });
});
