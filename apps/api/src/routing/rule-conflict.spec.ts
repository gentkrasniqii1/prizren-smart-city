import { describe, expect, it } from 'vitest';
import { Priority } from '@prisma/client';
import {
  conditionsOverlap,
  findAmbiguousConflict,
  type ConflictRuleSnapshot,
} from './rule-conflict';

function rule(
  partial: Partial<ConflictRuleSnapshot> & Pick<ConflictRuleSnapshot, 'id' | 'name'>,
): ConflictRuleSnapshot {
  return {
    active: true,
    priority: 100,
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    subcategory: 'Potholes',
    severity: Priority.HIGH,
    zoneId: 'zone-n',
    zone: 'North',
    isEmergency: true,
    departmentId: 'dept-a',
    institutionId: 'inst-a',
    ...partial,
  };
}

describe('conditionsOverlap', () => {
  it('detects identical conditions', () => {
    expect(conditionsOverlap(rule({ id: 'a', name: 'A' }), rule({ id: 'b', name: 'B' }))).toBe(
      true,
    );
  });

  it('detects wildcard severity overlapping HIGH', () => {
    expect(
      conditionsOverlap(
        rule({ id: 'a', name: 'A', severity: null }),
        rule({ id: 'b', name: 'B', severity: Priority.HIGH }),
      ),
    ).toBe(true);
  });

  it('does not overlap when severities differ', () => {
    expect(
      conditionsOverlap(
        rule({ id: 'a', name: 'A', severity: Priority.LOW }),
        rule({ id: 'b', name: 'B', severity: Priority.HIGH }),
      ),
    ).toBe(false);
  });
});

describe('findAmbiguousConflict', () => {
  it('rejects identical active rules with different destinations at same priority', () => {
    const candidate = rule({ id: '__new__', name: 'New', departmentId: 'dept-b' });
    const existing = [rule({ id: 'existing', name: 'Existing', departmentId: 'dept-a' })];
    const conflict = findAmbiguousConflict(candidate, existing);
    expect(conflict).not.toBeNull();
    expect(conflict?.message).toContain('conflicts with an existing active rule');
    expect(conflict?.message).toContain('Existing');
  });

  it('rejects wildcard overlap that is ambiguous at the same priority', () => {
    const candidate = rule({
      id: '__new__',
      name: 'Wildcard sev',
      severity: null,
      departmentId: 'dept-b',
    });
    const existing = [
      rule({ id: 'existing', name: 'High only', severity: Priority.HIGH, departmentId: 'dept-a' }),
    ];
    expect(findAmbiguousConflict(candidate, existing)).not.toBeNull();
  });

  it('allows overlap when priority numbers differ (deterministic)', () => {
    const candidate = rule({
      id: '__new__',
      name: 'Specific',
      priority: 10,
      departmentId: 'dept-b',
    });
    const existing = [
      rule({ id: 'existing', name: 'Broad', priority: 100, departmentId: 'dept-a' }),
    ];
    expect(findAmbiguousConflict(candidate, existing)).toBeNull();
  });

  it('ignores inactive peers', () => {
    const candidate = rule({ id: '__new__', name: 'New', departmentId: 'dept-b' });
    const existing = [rule({ id: 'old', name: 'Inactive', active: false, departmentId: 'dept-a' })];
    expect(findAmbiguousConflict(candidate, existing)).toBeNull();
  });

  it('does not conflict with itself on update', () => {
    const self = rule({ id: 'same', name: 'Self', departmentId: 'dept-a' });
    expect(findAmbiguousConflict(self, [self])).toBeNull();
  });

  it('allows identical destinations even when conditions overlap', () => {
    const candidate = rule({
      id: '__new__',
      name: 'Dup',
      departmentId: 'dept-a',
      institutionId: 'inst-a',
    });
    const existing = [
      rule({ id: 'existing', name: 'Same dest', departmentId: 'dept-a', institutionId: 'inst-a' }),
    ];
    expect(findAmbiguousConflict(candidate, existing)).toBeNull();
  });

  it('skips conflict checks when the candidate is inactive', () => {
    const candidate = rule({ id: '__new__', name: 'Off', active: false, departmentId: 'dept-b' });
    const existing = [rule({ id: 'existing', name: 'On', departmentId: 'dept-a' })];
    expect(findAmbiguousConflict(candidate, existing)).toBeNull();
  });
});
