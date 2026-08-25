import { Priority } from '@prisma/client';

/**
 * Snapshot used for overlap / ambiguity checks.
 * Null condition fields are wildcards (can match any fact value).
 */
export type ConflictRuleSnapshot = {
  id: string;
  name: string;
  active: boolean;
  /** Lower number wins in firstMatchingRule — different values make overlap deterministic. */
  priority: number;
  categoryId: string | null;
  subcategoryId: string | null;
  subcategory: string | null;
  severity: Priority | null;
  zoneId: string | null;
  zone: string | null;
  isEmergency: boolean | null;
  departmentId: string | null;
  institutionId: string | null;
};

export type RoutingConflict = {
  conflictingRule: ConflictRuleSnapshot;
  /** Human-readable explanation for API / admin UI. */
  message: string;
};

function subcategoryKey(rule: ConflictRuleSnapshot): string | null {
  if (rule.subcategoryId) return `id:${rule.subcategoryId}`;
  if (rule.subcategory?.trim()) return `name:${rule.subcategory.trim()}`;
  return null;
}

function zoneKey(rule: ConflictRuleSnapshot): string | null {
  if (rule.zoneId) return `id:${rule.zoneId}`;
  if (rule.zone?.trim()) return `name:${rule.zone.trim()}`;
  return null;
}

/** Two nullable keys overlap when either is wildcard or both equal. */
function keysOverlap(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return true;
  return a === b;
}

function severityOverlap(a: Priority | null, b: Priority | null): boolean {
  if (a == null || b == null) return true;
  return a === b;
}

function emergencyOverlap(a: boolean | null, b: boolean | null): boolean {
  if (a === null || b === null) return true;
  return a === b;
}

/**
 * True when there exists at least one concrete fact set that would match both rules.
 * Does not consider priority / destinations — only conditions.
 */
export function conditionsOverlap(a: ConflictRuleSnapshot, b: ConflictRuleSnapshot): boolean {
  if (!keysOverlap(a.categoryId, b.categoryId)) return false;
  if (!keysOverlap(subcategoryKey(a), subcategoryKey(b))) return false;
  if (!severityOverlap(a.severity, b.severity)) return false;
  if (!keysOverlap(zoneKey(a), zoneKey(b))) return false;
  if (!emergencyOverlap(a.isEmergency, b.isEmergency)) return false;
  return true;
}

export function destinationsDiffer(a: ConflictRuleSnapshot, b: ConflictRuleSnapshot): boolean {
  return a.departmentId !== b.departmentId || a.institutionId !== b.institutionId;
}

function describeOverlap(a: ConflictRuleSnapshot, b: ConflictRuleSnapshot): string {
  const parts: string[] = [];
  const cat = a.categoryId ?? b.categoryId;
  if (cat) parts.push('the same category');
  const sub = subcategoryKey(a) ?? subcategoryKey(b);
  if (sub) parts.push('the same subcategory');
  const sev = a.severity ?? b.severity;
  if (sev) parts.push(`${sev} severity`);
  else if (a.severity == null && b.severity == null) {
    /* both wildcards — omit */
  }
  const zone = zoneKey(a) ?? zoneKey(b);
  if (zone) parts.push('the same zone');
  const em = a.isEmergency ?? b.isEmergency;
  if (em === true) parts.push('emergency reports');
  else if (em === false) parts.push('non-emergency reports');

  if (parts.length === 0) return 'the same report conditions (all wildcards)';
  return parts.join(', ');
}

function destinationLabel(rule: ConflictRuleSnapshot): string {
  const dest = [rule.institutionId, rule.departmentId].filter(Boolean).join(' / ');
  return dest || 'unrouted';
}

/**
 * Ambiguous conflict when two *active* rules:
 * - can match the same report facts (condition overlap, including wildcards)
 * - route to different destinations
 * - share the same priority number (so firstMatchingRule has no deterministic precedence)
 *
 * Different priority numbers → allowed (lower number wins).
 * Inactive candidate or inactive peers → ignored.
 * Same id (self on update) → ignored.
 */
export function findAmbiguousConflict(
  candidate: ConflictRuleSnapshot,
  existing: ConflictRuleSnapshot[],
): RoutingConflict | null {
  if (!candidate.active) return null;

  for (const other of existing) {
    if (!other.active) continue;
    if (other.id === candidate.id) continue;
    if (!conditionsOverlap(candidate, other)) continue;
    if (!destinationsDiffer(candidate, other)) continue;
    if (candidate.priority !== other.priority) continue;

    const overlap = describeOverlap(candidate, other);
    const message =
      `This routing rule conflicts with an existing active rule "${other.name}". ` +
      `Both rules can match ${overlap} and route to different destinations ` +
      `(existing → ${destinationLabel(other)}; proposed → ${destinationLabel(candidate)}) ` +
      `at the same priority (${candidate.priority}), so the match is ambiguous. ` +
      `Change priority/order so one rule clearly wins, or narrow the conditions.`;

    return { conflictingRule: other, message };
  }

  return null;
}
