import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import type {
  AnalyticsByCategoryItem,
  AnalyticsByStatusItem,
  AnalyticsSummary,
} from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: AnalyticsQueryDto): Promise<AnalyticsSummary> {
    const where = this.buildWhere(query);

    const [total, pending, resolved, rejected, inReview, assigned, inProgress] =
      await Promise.all([
        this.prisma.report.count({ where }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.PENDING } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.RESOLVED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.REJECTED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.IN_REVIEW } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.ASSIGNED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.IN_PROGRESS } }),
      ]);

    const avgResolutionHours = await this.avgResolutionHours(where);

    return {
      total,
      pending,
      resolved,
      rejected,
      inReview,
      assigned,
      inProgress,
      avgResolutionHours,
    };
  }

  async byCategory(query: AnalyticsQueryDto): Promise<AnalyticsByCategoryItem[]> {
    const where = this.buildWhere(query);
    const grouped = await this.prisma.report.groupBy({
      by: ['categoryId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { categoryId: 'desc' } },
    });

    const categoryIds = grouped
      .map((g) => g.categoryId)
      .filter((id): id is string => Boolean(id));
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped.map((g) => ({
      categoryId: g.categoryId,
      category: g.categoryId ? (nameById.get(g.categoryId) ?? 'Unknown') : 'Uncategorized',
      count: g._count._all,
    }));
  }

  async byStatus(query: AnalyticsQueryDto): Promise<AnalyticsByStatusItem[]> {
    const where = this.buildWhere(query);
    const grouped = await this.prisma.report.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const order: ReportStatus[] = [
      ReportStatus.PENDING,
      ReportStatus.IN_REVIEW,
      ReportStatus.ASSIGNED,
      ReportStatus.IN_PROGRESS,
      ReportStatus.RESOLVED,
      ReportStatus.REJECTED,
    ];

    return order.map((status) => {
      const row = grouped.find((g) => g.status === status);
      return { status, count: row?._count._all ?? 0 };
    });
  }

  private buildWhere(query: AnalyticsQueryDto): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    return where;
  }

  private async avgResolutionHours(where: Prisma.ReportWhereInput): Promise<number | null> {
    const resolved = await this.prisma.report.findMany({
      where: { ...where, status: ReportStatus.RESOLVED },
      select: { id: true, createdAt: true },
    });
    if (resolved.length === 0) return null;

    const ids = resolved.map((r) => r.id);
    const history = await this.prisma.statusHistory.findMany({
      where: {
        reportId: { in: ids },
        newStatus: ReportStatus.RESOLVED,
      },
      orderBy: { changedAt: 'asc' },
      select: { reportId: true, changedAt: true },
    });

    const firstResolve = new Map<string, Date>();
    for (const h of history) {
      if (!firstResolve.has(h.reportId)) {
        firstResolve.set(h.reportId, h.changedAt);
      }
    }

    let totalHours = 0;
    let counted = 0;
    for (const report of resolved) {
      const resolvedAt = firstResolve.get(report.id) ?? report.createdAt;
      const hours = (resolvedAt.getTime() - report.createdAt.getTime()) / (1000 * 60 * 60);
      if (hours >= 0) {
        totalHours += hours;
        counted += 1;
      }
    }

    if (counted === 0) return null;
    return Math.round((totalHours / counted) * 10) / 10;
  }
}
