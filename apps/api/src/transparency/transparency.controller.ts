import { Controller, Get } from '@nestjs/common';
import type { TransparencyStats } from '@prizren/shared-types';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('transparency')
export class TransparencyController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async getStats(): Promise<TransparencyStats> {
    const emptyQuery = {};
    const [summary, byStatus, byCategory] = await Promise.all([
      this.analytics.summary(emptyQuery),
      this.analytics.byStatus(emptyQuery),
      this.analytics.byCategory(emptyQuery),
    ]);

    const pendingOpen = summary.pending + summary.inReview + summary.assigned + summary.inProgress;
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
