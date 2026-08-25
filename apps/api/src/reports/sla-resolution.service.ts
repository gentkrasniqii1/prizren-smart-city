import { Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveSla,
  type ResolvedSla,
  type SlaResolveFacts,
  type SlaUnresolved,
} from './sla-resolve';

@Injectable()
export class SlaResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the most specific active SLA for report facts.
   * Returns an unresolved result when priority is missing or no policy matches —
   * never invents minutes.
   */
  async resolveForFacts(
    facts: SlaResolveFacts,
    from = new Date(),
  ): Promise<ResolvedSla | SlaUnresolved> {
    if (!facts.priority) {
      return resolveSla([], facts, from);
    }
    const policies = await this.prisma.slaPolicy.findMany({
      where: { active: true, priority: facts.priority },
      select: {
        id: true,
        name: true,
        priority: true,
        responseTime: true,
        resolutionTime: true,
        departmentId: true,
        categoryId: true,
        subcategoryId: true,
        active: true,
      },
    });
    return resolveSla(policies, facts, from);
  }

  async resolveForReport(
    report: {
      departmentId?: string | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      priority?: Priority | null;
    },
    from = new Date(),
  ): Promise<ResolvedSla | SlaUnresolved> {
    return this.resolveForFacts(
      {
        departmentId: report.departmentId,
        categoryId: report.categoryId,
        subcategoryId: report.subcategoryId,
        priority: report.priority,
      },
      from,
    );
  }
}
