import { describe, expect, it } from 'vitest';
import { Priority } from '@prisma/client';
import {
  computeSlaDeadlines,
  resolveSla,
  selectSlaPolicy,
  slaPoliciesConflict,
  slaScopeOf,
  type SlaPolicyCandidate,
} from './sla-resolve';

function policy(
  partial: Partial<SlaPolicyCandidate> & Pick<SlaPolicyCandidate, 'id' | 'name' | 'priority'>,
): SlaPolicyCandidate {
  return {
    responseTime: 60,
    resolutionTime: 1440,
    departmentId: null,
    categoryId: null,
    subcategoryId: null,
    active: true,
    ...partial,
  };
}

const globals: SlaPolicyCandidate[] = [
  policy({
    id: 'g-low',
    name: 'SLA e ulët',
    priority: Priority.LOW,
    responseTime: 2880,
    resolutionTime: 14400,
  }),
  policy({
    id: 'g-med',
    name: 'SLA e mesme',
    priority: Priority.MEDIUM,
    responseTime: 1440,
    resolutionTime: 7200,
  }),
  policy({
    id: 'g-high',
    name: 'SLA e lartë',
    priority: Priority.HIGH,
    responseTime: 240,
    resolutionTime: 2880,
  }),
  policy({
    id: 'g-crit',
    name: 'SLA Kritike',
    priority: Priority.CRITICAL,
    responseTime: 60,
    resolutionTime: 1440,
  }),
];

describe('slaScopeOf', () => {
  it('classifies scopes', () => {
    expect(slaScopeOf({ departmentId: null, categoryId: null, subcategoryId: null })).toBe(
      'global',
    );
    expect(slaScopeOf({ departmentId: 'd', categoryId: null, subcategoryId: null })).toBe(
      'department',
    );
    expect(slaScopeOf({ departmentId: 'd', categoryId: 'c', subcategoryId: null })).toBe(
      'category',
    );
    expect(slaScopeOf({ departmentId: 'd', categoryId: 'c', subcategoryId: 's' })).toBe(
      'subcategory',
    );
  });
});

describe('selectSlaPolicy / resolveSla precedence', () => {
  const dept = policy({
    id: 'dept-high',
    name: 'Dept HIGH',
    priority: Priority.HIGH,
    departmentId: 'dept-1',
    responseTime: 120,
    resolutionTime: 1000,
  });
  const cat = policy({
    id: 'cat-high',
    name: 'Cat HIGH',
    priority: Priority.HIGH,
    departmentId: 'dept-1',
    categoryId: 'cat-1',
    responseTime: 90,
    resolutionTime: 900,
  });
  const sub = policy({
    id: 'sub-high',
    name: 'Sub HIGH',
    priority: Priority.HIGH,
    departmentId: 'dept-1',
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    responseTime: 30,
    resolutionTime: 300,
  });
  const all = [...globals, dept, cat, sub];

  it('falls back to global', () => {
    expect(selectSlaPolicy(globals, { priority: Priority.HIGH, departmentId: 'other' })?.id).toBe(
      'g-high',
    );
  });

  it('department overrides global', () => {
    expect(
      selectSlaPolicy(all, {
        priority: Priority.HIGH,
        departmentId: 'dept-1',
      })?.id,
    ).toBe('dept-high');
  });

  it('category overrides department', () => {
    expect(
      selectSlaPolicy(all, {
        priority: Priority.HIGH,
        departmentId: 'dept-1',
        categoryId: 'cat-1',
      })?.id,
    ).toBe('cat-high');
  });

  it('subcategory overrides category', () => {
    expect(
      selectSlaPolicy(all, {
        priority: Priority.HIGH,
        departmentId: 'dept-1',
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
      })?.id,
    ).toBe('sub-high');
  });

  it('matches exact priority only', () => {
    expect(
      selectSlaPolicy(all, {
        priority: Priority.LOW,
        departmentId: 'dept-1',
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
      })?.id,
    ).toBe('g-low');
  });

  it('ignores inactive policies', () => {
    const inactiveSub = { ...sub, active: false };
    expect(
      selectSlaPolicy([...globals, dept, cat, inactiveSub], {
        priority: Priority.HIGH,
        departmentId: 'dept-1',
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
      })?.id,
    ).toBe('cat-high');
  });

  it('returns controlled unresolved when priority missing', () => {
    const result = resolveSla(all, { departmentId: 'dept-1' });
    expect(result.policy).toBeNull();
    if (!result.policy) expect(result.reason).toBe('missing_priority');
  });

  it('returns controlled unresolved when no policy matches', () => {
    const result = resolveSla([], { priority: Priority.HIGH, departmentId: 'dept-1' });
    expect(result.policy).toBeNull();
    if (!result.policy) expect(result.reason).toBe('no_matching_policy');
  });
});

describe('computeSlaDeadlines', () => {
  it('adds response/resolution minutes in UTC', () => {
    const from = new Date('2026-08-25T10:00:00.000Z');
    const { responseDueAt, resolutionDueAt } = computeSlaDeadlines(
      { responseTime: 60, resolutionTime: 1440 },
      from,
    );
    expect(responseDueAt.toISOString()).toBe('2026-08-25T11:00:00.000Z');
    expect(resolutionDueAt.toISOString()).toBe('2026-08-26T10:00:00.000Z');
  });
});

describe('slaPoliciesConflict', () => {
  it('rejects identical active scope+priority', () => {
    const a = policy({ id: 'a', name: 'A', priority: Priority.HIGH, departmentId: 'd1' });
    const b = policy({ id: 'b', name: 'B', priority: Priority.HIGH, departmentId: 'd1' });
    expect(slaPoliciesConflict(a, b)).toBe(true);
  });

  it('allows same scope different priority', () => {
    const a = policy({ id: 'a', name: 'A', priority: Priority.HIGH, departmentId: 'd1' });
    const b = policy({ id: 'b', name: 'B', priority: Priority.LOW, departmentId: 'd1' });
    expect(slaPoliciesConflict(a, b)).toBe(false);
  });

  it('allows global + department', () => {
    const a = policy({ id: 'a', name: 'A', priority: Priority.HIGH });
    const b = policy({ id: 'b', name: 'B', priority: Priority.HIGH, departmentId: 'd1' });
    expect(slaPoliciesConflict(a, b)).toBe(false);
  });

  it('allows department + category', () => {
    const a = policy({ id: 'a', name: 'A', priority: Priority.HIGH, departmentId: 'd1' });
    const b = policy({
      id: 'b',
      name: 'B',
      priority: Priority.HIGH,
      departmentId: 'd1',
      categoryId: 'c1',
    });
    expect(slaPoliciesConflict(a, b)).toBe(false);
  });

  it('allows category + subcategory', () => {
    const a = policy({
      id: 'a',
      name: 'A',
      priority: Priority.HIGH,
      departmentId: 'd1',
      categoryId: 'c1',
    });
    const b = policy({
      id: 'b',
      name: 'B',
      priority: Priority.HIGH,
      departmentId: 'd1',
      categoryId: 'c1',
      subcategoryId: 's1',
    });
    expect(slaPoliciesConflict(a, b)).toBe(false);
  });

  it('allows inactive duplicate', () => {
    const a = policy({
      id: 'a',
      name: 'A',
      priority: Priority.HIGH,
      departmentId: 'd1',
      active: false,
    });
    const b = policy({ id: 'b', name: 'B', priority: Priority.HIGH, departmentId: 'd1' });
    expect(slaPoliciesConflict(a, b)).toBe(false);
  });

  it('does not conflict with itself', () => {
    const a = policy({ id: 'same', name: 'A', priority: Priority.HIGH, departmentId: 'd1' });
    expect(slaPoliciesConflict(a, a)).toBe(false);
  });
});

describe('historical snapshot stability', () => {
  it('deadlines stay fixed after policy minutes change', () => {
    const from = new Date('2026-08-25T10:00:00.000Z');
    const snap = computeSlaDeadlines({ responseTime: 60, resolutionTime: 1440 }, from);
    // Admin edits policy later — report snapshot must keep original dates.
    const edited = computeSlaDeadlines({ responseTime: 999, resolutionTime: 9999 }, from);
    expect(snap.responseDueAt.toISOString()).toBe('2026-08-25T11:00:00.000Z');
    expect(snap.resolutionDueAt.toISOString()).toBe('2026-08-26T10:00:00.000Z');
    expect(edited.responseDueAt.toISOString()).not.toBe(snap.responseDueAt.toISOString());
  });
});
