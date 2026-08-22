import { Controller, Get } from '@nestjs/common';
import type { TransparencyStats } from '@prizren/shared-types';
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

    const publicOpen = new Set(['ASSIGNED', 'RECEIVED', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION']);
    const pendingOpen = byStatus
      .filter((row) => publicOpen.has(row.status))
      .reduce((sum, row) => sum + row.count, 0);
    const resolutionRate =
      summary.total > 0 ? Math.round((summary.resolved / summary.total) * 1000) / 10 : null;

    return {
      total: summary.total,
      resolved: summary.resolved,
      pendingOpen,
      rejected: summary.rejected,
      resolutionRate,
      byStatus,
      byCategory,
      avgResolutionHours: summary.avgResolutionHours,
    };
  }
}
