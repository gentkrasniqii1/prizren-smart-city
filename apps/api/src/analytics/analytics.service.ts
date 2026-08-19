import { Injectable } from '@nestjs/common';
import { Prisma, Priority, ReportStatus } from '@prisma/client';
import type {
  AnalyticsByCategoryItem,
  AnalyticsByDepartmentItem,
  AnalyticsByInstitutionItem,
  AnalyticsByStatusItem,
  AnalyticsOverTimeItem,
  AnalyticsSla,
  AnalyticsSummary,
} from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { DUE_SOON_MS, OPEN_REPORT_STATUSES } from '../reports/sla';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(query: AnalyticsQueryDto): Promise<AnalyticsSummary> {
    const where = this.buildWhere(query);

    const [total, pending, resolved, rejected, inReview, assigned, inProgress, newToday, critical] =
      await Promise.all([
        this.prisma.report.count({ where }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.SUBMITTED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.RESOLVED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.REJECTED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.UNDER_REVIEW } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.ASSIGNED } }),
        this.prisma.report.count({ where: { ...where, status: ReportStatus.IN_PROGRESS } }),
        this.prisma.report.count({
          where: withCreatedSince(where, startOfToday()),
        }),
        this.prisma.report.count({
          where: {
            ...where,
            priority: Priority.CRITICAL,
            status: { in: OPEN_REPORT_STATUSES },
          },
        }),
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
      newToday,
      critical,
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

    const categoryIds = grouped.map((g) => g.categoryId).filter((id): id is string => Boolean(id));
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

  async byDepartment(query: AnalyticsQueryDto): Promise<AnalyticsByDepartmentItem[]> {
    const where = this.buildWhere(query);
    const grouped = await this.prisma.report.groupBy({
      by: ['departmentId'],
      where,
      _count: { _all: true },
    });

    const departmentIds = grouped
      .map((g) => g.departmentId)
      .filter((id): id is string => Boolean(id));
    const departments = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(departments.map((d) => [d.id, d.name]));

    return grouped
      .map((g) => ({
        departmentId: g.departmentId,
        department: g.departmentId ? (nameById.get(g.departmentId) ?? 'Unknown') : 'Unassigned',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async byInstitution(query: AnalyticsQueryDto): Promise<AnalyticsByInstitutionItem[]> {
    const where = this.buildWhere(query);
    const grouped = await this.prisma.report.groupBy({
      by: ['institutionId'],
      where,
      _count: { _all: true },
    });

    const institutionIds = grouped
      .map((g) => g.institutionId)
      .filter((id): id is string => Boolean(id));
    const institutions = institutionIds.length
      ? await this.prisma.institution.findMany({
          where: { id: { in: institutionIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(institutions.map((i) => [i.id, i.name]));

    return grouped
      .map((g) => ({
        institutionId: g.institutionId,
        institution: g.institutionId ? (nameById.get(g.institutionId) ?? 'Unknown') : 'Unassigned',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async overTime(query: AnalyticsQueryDto): Promise<AnalyticsOverTimeItem[]> {
    const conditions: Prisma.Sql[] = [];
    if (query.departmentId) {
      conditions.push(Prisma.sql`"departmentId" = ${query.departmentId}`);
    }
    if (query.institutionId) {
      conditions.push(Prisma.sql`"institutionId" = ${query.institutionId}`);
    }
    if (query.from) {
      conditions.push(Prisma.sql`"createdAt" >= ${new Date(query.from)}`);
    }
    if (query.to) {
      conditions.push(Prisma.sql`"createdAt" <= ${new Date(query.to)}`);
    }
    // With no explicit range, default to the last 30 days so the trend line
    // stays readable instead of one bar per day since the platform launched.
    if (!query.from && !query.to) {
      conditions.push(Prisma.sql`"createdAt" >= NOW() - INTERVAL '30 days'`);
    }
    const whereClause = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
      FROM "Report"
      ${whereClause}
      GROUP BY day
      ORDER BY day ASC
    `);

    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
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
      ReportStatus.SUBMITTED,
      ReportStatus.RECEIVED,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.ASSIGNED,
      ReportStatus.IN_PROGRESS,
      ReportStatus.WAITING_FOR_INFORMATION,
      ReportStatus.RESOLVED,
      ReportStatus.REJECTED,
      ReportStatus.DUPLICATE,
    ];

    return order.map((status) => {
      const row = grouped.find((g) => g.status === status);
      return { status, count: row?._count._all ?? 0 };
    });
  }

  async sla(query: AnalyticsQueryDto): Promise<AnalyticsSla> {
    const where = this.buildWhere(query);
    const now = new Date();
    const dueSoonUntil = new Date(now.getTime() + DUE_SOON_MS);

    const openWithDue: Prisma.ReportWhereInput = {
      ...where,
      status: { in: OPEN_REPORT_STATUSES },
      dueAt: { not: null },
    };

    const [overdue, dueSoon, onTime] = await Promise.all([
      this.prisma.report.count({
        where: { ...openWithDue, dueAt: { lt: now } },
      }),
      this.prisma.report.count({
        where: {
          ...openWithDue,
          dueAt: { gte: now, lte: dueSoonUntil },
        },
      }),
      this.prisma.report.count({
        where: {
          ...openWithDue,
          dueAt: { gt: dueSoonUntil },
        },
      }),
    ]);

    return { overdue, dueSoon, onTime };
  }

  private buildWhere(query: AnalyticsQueryDto): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.institutionId) where.institutionId = query.institutionId;
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

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function withCreatedSince(where: Prisma.ReportWhereInput, since: Date): Prisma.ReportWhereInput {
  const existing = where.createdAt;
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return { ...where, createdAt: { gte: since } };
  }
  const currentGte = 'gte' in existing && existing.gte instanceof Date ? existing.gte : undefined;
  const gte = currentGte && currentGte > since ? currentGte : since;
  return { ...where, createdAt: { ...existing, gte } };
}
