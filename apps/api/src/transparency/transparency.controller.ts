import { Controller, Get } from '@nestjs/common';
import { isPublicReportStatus, type TransparencyStats } from '@prizren/shared-types';
import { AnalyticsService } from '../analytics/analytics.service';
import { DepartmentsService } from '../departments/departments.service';

@Controller('transparency')
export class TransparencyController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly departments: DepartmentsService,
  ) {}

  @Get()
  async getStats(): Promise<TransparencyStats> {
    const publicOnly = { publicOnly: true };
    const [summary, byStatus, byCategory, departments] = await Promise.all([
      this.analytics.summary(publicOnly),
      this.analytics.byStatus(publicOnly),
      this.analytics.byCategory(publicOnly),
      this.departments.list(true),
    ]);

    // Official cases still in the civic pipeline (RESOLVED is public, but not "open").
    const pendingOpen = byStatus
      .filter((row) => isPublicReportStatus(row.status) && row.status !== 'RESOLVED')
      .reduce((sum, row) => sum + row.count, 0);
    const resolutionRate =
      summary.total > 0 ? Math.round((summary.resolved / summary.total) * 1000) / 10 : null;

    const contacts = departments
      .filter((dept) => Boolean(dept.contact?.trim()))
      .map((dept) => ({
        departmentName: dept.name,
        phone: dept.contact!.trim(),
        institutionName: dept.institutionName ?? null,
      }));

    return {
      total: summary.total,
      resolved: summary.resolved,
      pendingOpen,
      rejected: 0,
      resolutionRate,
      byStatus: byStatus.filter((row) => isPublicReportStatus(row.status)),
      byCategory,
      avgResolutionHours: summary.avgResolutionHours,
      contacts,
    };
  }
}
