import { Controller, Get } from '@nestjs/common';
import { PUBLIC_REPORT_STATUSES, type TransparencyStats } from '@prizren/shared-types';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('transparency')
export class TransparencyController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async getStats(): Promise<TransparencyStats> {
    const publicOnly = { publicOnly: true };
    const [summary, byStatus, byCategory] = await Promise.all([
      this.analytics.summary(publicOnly),
      this.analytics.byStatus(publicOnly),
      this.analytics.byCategory(publicOnly),
    ]);

    const publicOpen = new Set(PUBLIC_REPORT_STATUSES.filter((status) => status !== 'RESOLVED'));
    const pendingOpen = byStatus
      .filter((row) => publicOpen.has(row.status))
      .reduce((sum, row) => sum + row.count, 0);
    const resolutionRate =
      summary.total > 0 ? Math.round((summary.resolved / summary.total) * 1000) / 10 : null;

    return {
      total: summary.total,
      resolved: summary.resolved,
      pendingOpen,
      rejected: 0,
      resolutionRate,
      byStatus: byStatus.filter((row) => (PUBLIC_REPORT_STATUSES as string[]).includes(row.status)),
      byCategory,
      avgResolutionHours: summary.avgResolutionHours,
    };
  }
}
