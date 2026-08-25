import { ReportStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransparencyController } from './transparency.controller';
import { AnalyticsService } from '../analytics/analytics.service';
import { DepartmentsService } from '../departments/departments.service';

describe('TransparencyController', () => {
  let summary: ReturnType<typeof vi.fn>;
  let byStatus: ReturnType<typeof vi.fn>;
  let byCategory: ReturnType<typeof vi.fn>;
  let listDepartments: ReturnType<typeof vi.fn>;
  let controller: TransparencyController;

  beforeEach(() => {
    summary = vi.fn().mockResolvedValue({
      total: 10,
      pending: 2,
      resolved: 4,
      rejected: 3,
      inReview: 1,
      assigned: 3,
      inProgress: 2,
      avgResolutionHours: 12,
      newToday: 1,
      critical: 0,
    });
    byStatus = vi.fn().mockResolvedValue([
      { status: ReportStatus.SUBMITTED, count: 0 },
      { status: ReportStatus.ASSIGNED, count: 3 },
      { status: ReportStatus.RESOLVED, count: 4 },
      { status: ReportStatus.REJECTED, count: 0 },
    ]);
    byCategory = vi.fn().mockResolvedValue([{ categoryId: 'c1', category: 'Ndriçimi', count: 5 }]);
    listDepartments = vi.fn().mockResolvedValue([
      {
        id: 'd1',
        name: 'Shërbime Publike',
        contact: '038 200 44 730',
        slaHours: 48,
        institutionId: 'i1',
        institutionName: 'Komuna e Prizrenit',
      },
      {
        id: 'd2',
        name: 'Administratë',
        contact: null,
        slaHours: 168,
        institutionId: 'i1',
        institutionName: 'Komuna e Prizrenit',
      },
    ]);
    controller = new TransparencyController(
      {
        summary,
        byStatus,
        byCategory,
      } as unknown as AnalyticsService,
      {
        list: listDepartments,
      } as unknown as DepartmentsService,
    );
  });

  it('counts only approved public statuses and omits rejected/unapproved rows', async () => {
    const stats = await controller.getStats();
    expect(summary).toHaveBeenCalledWith({ publicOnly: true });
    expect(stats.total).toBe(10);
    expect(stats.resolved).toBe(4);
    expect(stats.pendingOpen).toBe(3);
    expect(stats.rejected).toBe(0);
    expect(stats.byStatus.map((row) => row.status)).toEqual([
      ReportStatus.ASSIGNED,
      ReportStatus.RESOLVED,
    ]);
    expect(stats.byStatus.some((row) => row.status === ReportStatus.SUBMITTED)).toBe(false);
    expect(stats.byStatus.some((row) => row.status === ReportStatus.REJECTED)).toBe(false);
  });

  it('exposes only departments with verified public phone contacts', async () => {
    const stats = await controller.getStats();
    expect(listDepartments).toHaveBeenCalledWith(true);
    expect(stats.contacts).toEqual([
      {
        departmentName: 'Shërbime Publike',
        phone: '038 200 44 730',
        institutionName: 'Komuna e Prizrenit',
      },
    ]);
  });
});
