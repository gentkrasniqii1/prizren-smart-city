import { Priority } from '@prisma/client';

export type SlaScope = 'global' | 'department' | 'category' | 'subcategory';

export type SlaPolicyCandidate = {
  id: string;
  name: string;
  priority: Priority;
  responseTime: number;
  resolutionTime: number;
  departmentId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  active: boolean;
};

export type SlaResolveFacts = {
  departmentId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  priority?: Priority | null;
};

export type ResolvedSla = {
  policy: SlaPolicyCandidate;
  scope: SlaScope;
  responseDueAt: Date;
  resolutionDueAt: Date;
};

export type SlaUnresolved = {
  policy: null;
  scope: null;
  responseDueAt: null;
  resolutionDueAt: null;
  reason: 'missing_priority' | 'no_matching_policy';
};

/**
 * Scope specificity (higher = more specific).
 * Subcategory > Category > Department > Global.
 */
export function slaScopeOf(policy: {
  departmentId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
}): SlaScope {
  if (policy.subcategoryId) return 'subcategory';
  if (policy.categoryId) return 'category';
  if (policy.departmentId) return 'department';
  return 'global';
}

export function slaScopeRank(scope: SlaScope): number {
  switch (scope) {
    case 'subcategory':
      return 4;
    case 'category':
      return 3;
    case 'department':
      return 2;
    case 'global':
      return 1;
  }
}

/** Whether a policy's fixed scope can apply to the given report facts. */
export function policyMatchesFacts(policy: SlaPolicyCandidate, facts: SlaResolveFacts): boolean {
  if (!policy.active) return false;
  if (!facts.priority || policy.priority !== facts.priority) return false;

  const scope = slaScopeOf(policy);
  switch (scope) {
    case 'global':
      return (
        policy.departmentId == null && policy.categoryId == null && policy.subcategoryId == null
      );
    case 'department':
      return (
        policy.departmentId != null &&
        policy.categoryId == null &&
        policy.subcategoryId == null &&
        policy.departmentId === facts.departmentId
      );
    case 'category':
      return (
        policy.departmentId != null &&
        policy.categoryId != null &&
        policy.subcategoryId == null &&
        policy.departmentId === facts.departmentId &&
        policy.categoryId === facts.categoryId
      );
    case 'subcategory':
      return (
        policy.departmentId != null &&
        policy.categoryId != null &&
        policy.subcategoryId != null &&
        policy.departmentId === facts.departmentId &&
        policy.categoryId === facts.categoryId &&
        policy.subcategoryId === facts.subcategoryId
      );
  }
}

/**
 * Pick the most specific matching active policy for the given priority.
 * Ties at the same scope are undefined — writers must prevent identical active scopes.
 */
export function selectSlaPolicy(
  policies: SlaPolicyCandidate[],
  facts: SlaResolveFacts,
): SlaPolicyCandidate | null {
  const matches = policies.filter((p) => policyMatchesFacts(p, facts));
  if (matches.length === 0) return null;
  matches.sort((a, b) => slaScopeRank(slaScopeOf(b)) - slaScopeRank(slaScopeOf(a)));
  return matches[0] ?? null;
}

/** Elapsed-minute deadlines from a UTC start instant. */
export function computeSlaDeadlines(
  policy: Pick<SlaPolicyCandidate, 'responseTime' | 'resolutionTime'>,
  from = new Date(),
): { responseDueAt: Date; resolutionDueAt: Date } {
  const start = from.getTime();
  return {
    responseDueAt: new Date(start + policy.responseTime * 60_000),
    resolutionDueAt: new Date(start + policy.resolutionTime * 60_000),
  };
}

export function resolveSla(
  policies: SlaPolicyCandidate[],
  facts: SlaResolveFacts,
  from = new Date(),
): ResolvedSla | SlaUnresolved {
  if (!facts.priority) {
    return {
      policy: null,
      scope: null,
      responseDueAt: null,
      resolutionDueAt: null,
      reason: 'missing_priority',
    };
  }
  const policy = selectSlaPolicy(policies, facts);
  if (!policy) {
    return {
      policy: null,
      scope: null,
      responseDueAt: null,
      resolutionDueAt: null,
      reason: 'no_matching_policy',
    };
  }
  const deadlines = computeSlaDeadlines(policy, from);
  return {
    policy,
    scope: slaScopeOf(policy),
    responseDueAt: deadlines.responseDueAt,
    resolutionDueAt: deadlines.resolutionDueAt,
  };
}

/** Two active policies conflict when they share the same effective scope + priority. */
export function slaPoliciesConflict(
  a: Pick<
    SlaPolicyCandidate,
    'id' | 'active' | 'priority' | 'departmentId' | 'categoryId' | 'subcategoryId'
  >,
  b: Pick<
    SlaPolicyCandidate,
    'id' | 'active' | 'priority' | 'departmentId' | 'categoryId' | 'subcategoryId'
  >,
): boolean {
  if (!a.active || !b.active) return false;
  if (a.id === b.id) return false;
  if (a.priority !== b.priority) return false;
  return (
    (a.departmentId ?? null) === (b.departmentId ?? null) &&
    (a.categoryId ?? null) === (b.categoryId ?? null) &&
    (a.subcategoryId ?? null) === (b.subcategoryId ?? null)
  );
}
