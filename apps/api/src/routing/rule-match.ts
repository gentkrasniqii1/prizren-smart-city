import { Priority } from '@prisma/client';

/** Match context for a routing rule. Null/undefined fields are not tested. */
export type RoutingFacts = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  subcategory?: string | null;
  severity?: Priority | null;
  zoneId?: string | null;
  zone?: string | null;
  isEmergency?: boolean | null;
};

export type RoutingRuleMatchInput = {
  categoryId: string | null;
  subcategoryId?: string | null;
  subcategory: string | null;
  severity: Priority | null;
  zoneId?: string | null;
  zone: string | null;
  isEmergency: boolean | null;
  active: boolean;
  priority: number;
};

/**
 * Null fields on a rule are wildcards. A rule requiring a concrete value does
 * NOT match when that fact is missing (null/undefined).
 *
 * Ranking: firstMatchingRule sorts by `priority` ascending (lower number wins).
 * There is no separate specificity score — admins set order explicitly.
 */
export function ruleMatches(rule: RoutingRuleMatchInput, facts: RoutingFacts): boolean {
  if (!rule.active) return false;
  if (rule.categoryId && rule.categoryId !== facts.categoryId) return false;

  if (rule.subcategoryId) {
    if (facts.subcategoryId) {
      if (rule.subcategoryId !== facts.subcategoryId) return false;
    } else if (rule.subcategory) {
      if (rule.subcategory !== facts.subcategory) return false;
    } else {
      return false;
    }
  } else if (rule.subcategory && rule.subcategory !== facts.subcategory) {
    return false;
  }

  if (rule.severity != null) {
    if (facts.severity == null || rule.severity !== facts.severity) return false;
  }

  if (rule.zoneId) {
    if (facts.zoneId) {
      if (rule.zoneId !== facts.zoneId) return false;
    } else if (rule.zone) {
      if (rule.zone !== facts.zone) return false;
    } else {
      return false;
    }
  } else if (rule.zone) {
    if (facts.zone == null || rule.zone !== facts.zone) return false;
  }

  if (rule.isEmergency !== null) {
    if (facts.isEmergency === null || facts.isEmergency === undefined) return false;
    if (rule.isEmergency !== facts.isEmergency) return false;
  }

  return true;
}

/**
 * Deterministic precedence: lowest `priority` number among matching rules wins.
 * Ties keep stable array order from the caller (typically createdAt asc from DB).
 * Prefer distinct priority values when destinations differ — see rule-conflict.ts.
 */
export function firstMatchingRule<T extends RoutingRuleMatchInput>(
  rules: T[],
  facts: RoutingFacts,
): T | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find((rule) => ruleMatches(rule, facts)) ?? null;
}
