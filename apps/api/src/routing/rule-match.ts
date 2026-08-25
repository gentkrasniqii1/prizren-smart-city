import { Priority } from '@prisma/client';

/** Match context for a routing rule. Null/undefined fields are not tested. */
export type RoutingFacts = {
  categoryId?: string | null;
  subcategoryId?: string | null;
  subcategory?: string | null;
  severity?: Priority | null;
  zone?: string | null;
  isEmergency?: boolean | null;
};

export type RoutingRuleMatchInput = {
  categoryId: string | null;
  subcategoryId?: string | null;
  subcategory: string | null;
  severity: Priority | null;
  zone: string | null;
  isEmergency: boolean | null;
  active: boolean;
  priority: number;
};

/**
 * Null fields on a rule are wildcards. Code never maps a category *name* to an
 * organization — only configured rule fields (and then category fallback).
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
  if (rule.severity && rule.severity !== facts.severity) return false;
  if (rule.zone && rule.zone !== facts.zone) return false;
  if (rule.isEmergency !== null && rule.isEmergency !== facts.isEmergency) return false;
  return true;
}

export function firstMatchingRule<T extends RoutingRuleMatchInput>(
  rules: T[],
  facts: RoutingFacts,
): T | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find((rule) => ruleMatches(rule, facts)) ?? null;
}
