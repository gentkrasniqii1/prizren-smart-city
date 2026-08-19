import { BadRequestException, Injectable } from '@nestjs/common';
import { Priority } from '@prisma/client';
import type { RoutePreview } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { firstMatchingRule, type RoutingFacts } from './rule-match';
import { resolveRouteChain } from './resolve-chain';

export type RoutedAssignment = {
  categoryId: string;
  departmentId: string | null;
  institutionId: string | null;
  slaHours: number;
  defaultPriority: Priority;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  source: RoutePreview['source'];
};

/**
 * Automatic routing engine: category → institution → department.
 * Organization names are never hard-coded here — only configured rules
 * and the category's fallback department/institution.
 */
@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async routeByCategory(categoryId: string | undefined | null): Promise<RoutedAssignment | null> {
    if (!categoryId) return null;
    return this.route({ categoryId });
  }

  async route(facts: RoutingFacts & { categoryId: string }): Promise<RoutedAssignment> {
    const category = await this.prisma.category.findUnique({
      where: { id: facts.categoryId },
      include: {
        department: { include: { institution: true } },
      },
    });
    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }

    const rules = await this.prisma.routingRule.findMany({
      where: { active: true },
      include: {
        department: { include: { institution: true } },
        institution: true,
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const enriched: RoutingFacts = {
      ...facts,
      isEmergency:
        facts.isEmergency ??
        (category.defaultPriority === Priority.CRITICAL ? true : facts.isEmergency),
    };

    const matched = firstMatchingRule(rules, enriched);
    const chain = resolveRouteChain(
      matched
        ? {
            departmentId: matched.departmentId,
            institutionId: matched.institutionId,
            slaHours: matched.slaHours,
            defaultPriority: matched.defaultPriority,
            department: matched.department
              ? {
                  institutionId: matched.department.institutionId,
                  slaHours: matched.department.slaHours,
                }
              : null,
          }
        : null,
      {
        departmentId: category.departmentId,
        slaHours: category.slaHours,
        defaultPriority: category.defaultPriority,
        department: category.department
          ? {
              institutionId: category.department.institutionId,
              slaHours: category.department.slaHours,
            }
          : null,
      },
    );

    return {
      categoryId: category.id,
      departmentId: chain.departmentId,
      institutionId: chain.institutionId,
      slaHours: chain.slaHours,
      defaultPriority: chain.defaultPriority,
      matchedRuleId: matched?.id ?? null,
      matchedRuleName: matched?.name ?? null,
      source: chain.source,
    };
  }

  async preview(facts: RoutingFacts & { categoryId: string }): Promise<RoutePreview> {
    const routed = await this.route(facts);
    const [department, institution, category] = await Promise.all([
      routed.departmentId
        ? this.prisma.department.findUnique({
            where: { id: routed.departmentId },
            select: { name: true },
          })
        : null,
      routed.institutionId
        ? this.prisma.institution.findUnique({
            where: { id: routed.institutionId },
            select: { name: true },
          })
        : null,
      this.prisma.category.findUnique({
        where: { id: routed.categoryId },
        select: { name: true },
      }),
    ]);

    return {
      categoryId: routed.categoryId,
      categoryName: category?.name ?? '',
      departmentId: routed.departmentId,
      departmentName: department?.name ?? null,
      institutionId: routed.institutionId,
      institutionName: institution?.name ?? null,
      slaHours: routed.slaHours,
      defaultPriority: routed.defaultPriority,
      matchedRuleId: routed.matchedRuleId,
      matchedRuleName: routed.matchedRuleName,
      source: routed.source,
    };
  }
}
