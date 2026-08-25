import { describe, expect, it } from 'vitest';
import { Priority } from '@prisma/client';
import { firstMatchingRule, ruleMatches } from './rule-match';

const base = {
  categoryId: null as string | null,
  subcategoryId: null as string | null,
  subcategory: null as string | null,
  severity: null as Priority | null,
  zone: null as string | null,
  isEmergency: null as boolean | null,
  active: true,
  priority: 100,
};

describe('ruleMatches', () => {
  it('treats null fields as wildcards', () => {
    expect(ruleMatches(base, { categoryId: 'any' })).toBe(true);
  });

  it('does not encode category names — only configured ids', () => {
    const rule = { ...base, categoryId: 'cat-waste' };
    expect(ruleMatches(rule, { categoryId: 'cat-waste' })).toBe(true);
    expect(ruleMatches(rule, { categoryId: 'cat-roads' })).toBe(false);
  });

  it('requires emergency flag when the rule sets one', () => {
    const rule = { ...base, isEmergency: true };
    expect(ruleMatches(rule, { isEmergency: true })).toBe(true);
    expect(ruleMatches(rule, { isEmergency: false })).toBe(false);
    expect(ruleMatches(rule, {})).toBe(false);
  });

  it('matches subcategoryId when present, with name fallback', () => {
    const rule = {
      ...base,
      subcategoryId: 'sub-1',
      subcategory: 'Gropa',
    };
    expect(ruleMatches(rule, { subcategoryId: 'sub-1' })).toBe(true);
    expect(ruleMatches(rule, { subcategoryId: 'sub-2' })).toBe(false);
    expect(ruleMatches(rule, { subcategory: 'Gropa' })).toBe(true);
    expect(ruleMatches(rule, { subcategory: 'Other' })).toBe(false);
    expect(ruleMatches(rule, {})).toBe(false);
  });

  it('ignores inactive rules', () => {
    expect(ruleMatches({ ...base, active: false }, {})).toBe(false);
  });
});

describe('firstMatchingRule', () => {
  it('picks the lowest priority number among matches', () => {
    const rules = [
      { ...base, categoryId: 'c1', priority: 50, id: 'later' },
      { ...base, categoryId: 'c1', priority: 10, id: 'first' },
    ];
    expect(firstMatchingRule(rules, { categoryId: 'c1' })?.id).toBe('first');
  });

  it('returns null when nothing matches', () => {
    const rules = [{ ...base, categoryId: 'c1', priority: 10, id: 'x' }];
    expect(firstMatchingRule(rules, { categoryId: 'c2' })).toBeNull();
  });
});
