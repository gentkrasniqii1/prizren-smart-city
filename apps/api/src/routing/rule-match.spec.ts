import { describe, expect, it } from 'vitest';
import { Priority } from '@prisma/client';
import { firstMatchingRule, ruleMatches } from './rule-match';

const base = {
  categoryId: null as string | null,
  subcategoryId: null as string | null,
  subcategory: null as string | null,
  severity: null as Priority | null,
  zoneId: null as string | null,
  zone: null as string | null,
  isEmergency: null as boolean | null,
  active: true,
  priority: 100,
};

describe('ruleMatches — severity', () => {
  for (const sev of [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL] as const) {
    it(`matches ${sev} exactly`, () => {
      const rule = { ...base, severity: sev };
      expect(ruleMatches(rule, { severity: sev })).toBe(true);
      expect(
        ruleMatches(rule, { severity: Priority.LOW === sev ? Priority.HIGH : Priority.LOW }),
      ).toBe(false);
    });
  }

  it('treats null severity as wildcard', () => {
    expect(ruleMatches(base, { severity: Priority.CRITICAL })).toBe(true);
  });

  it('does not match when severity is required but missing on the report', () => {
    expect(ruleMatches({ ...base, severity: Priority.HIGH }, {})).toBe(false);
    expect(ruleMatches({ ...base, severity: Priority.HIGH }, { severity: null })).toBe(false);
  });
});

describe('ruleMatches — zone', () => {
  it('matches zoneId exactly', () => {
    const rule = { ...base, zoneId: 'zone-n', zone: 'North' };
    expect(ruleMatches(rule, { zoneId: 'zone-n' })).toBe(true);
    expect(ruleMatches(rule, { zoneId: 'zone-s' })).toBe(false);
  });

  it('falls back to zone name when fact has no zoneId', () => {
    const rule = { ...base, zoneId: 'zone-n', zone: 'North' };
    expect(ruleMatches(rule, { zone: 'North' })).toBe(true);
    expect(ruleMatches(rule, { zone: 'South' })).toBe(false);
  });

  it('treats null zone as wildcard', () => {
    expect(ruleMatches(base, { zoneId: 'any' })).toBe(true);
  });

  it('does not match when zone is required but missing', () => {
    expect(ruleMatches({ ...base, zoneId: 'zone-n', zone: 'North' }, {})).toBe(false);
  });
});

describe('ruleMatches — isEmergency', () => {
  it('true matches true only', () => {
    const rule = { ...base, isEmergency: true };
    expect(ruleMatches(rule, { isEmergency: true })).toBe(true);
    expect(ruleMatches(rule, { isEmergency: false })).toBe(false);
  });

  it('false matches false only', () => {
    const rule = { ...base, isEmergency: false };
    expect(ruleMatches(rule, { isEmergency: false })).toBe(true);
    expect(ruleMatches(rule, { isEmergency: true })).toBe(false);
  });

  it('null matches both emergency and non-emergency', () => {
    expect(ruleMatches(base, { isEmergency: true })).toBe(true);
    expect(ruleMatches(base, { isEmergency: false })).toBe(true);
  });

  it('does not match when emergency is required but missing', () => {
    expect(ruleMatches({ ...base, isEmergency: true }, {})).toBe(false);
    expect(ruleMatches({ ...base, isEmergency: false }, { isEmergency: null })).toBe(false);
  });

  it('emergency-only rules do not match null emergency facts', () => {
    expect(ruleMatches({ ...base, isEmergency: true }, { isEmergency: null })).toBe(false);
  });

  it('non-emergency-only rules do not match null emergency facts', () => {
    expect(ruleMatches({ ...base, isEmergency: false }, { isEmergency: null })).toBe(false);
  });

  it('explicit emergency true and false are independent of severity', () => {
    const emergencyRule = { ...base, isEmergency: true, severity: null };
    const severityRule = { ...base, severity: Priority.CRITICAL, isEmergency: null };
    expect(ruleMatches(emergencyRule, { isEmergency: true, severity: Priority.LOW })).toBe(true);
    expect(ruleMatches(severityRule, { severity: Priority.CRITICAL, isEmergency: null })).toBe(
      true,
    );
    expect(ruleMatches(severityRule, { severity: Priority.CRITICAL, isEmergency: false })).toBe(
      true,
    );
    expect(ruleMatches(emergencyRule, { isEmergency: null, severity: Priority.CRITICAL })).toBe(
      false,
    );
  });
});

describe('ruleMatches — combined', () => {
  it('requires every specified condition', () => {
    const rule = {
      ...base,
      categoryId: 'cat-road',
      subcategoryId: 'sub-pothole',
      subcategory: 'Potholes',
      severity: Priority.HIGH,
      zoneId: 'zone-n',
      zone: 'North',
      isEmergency: true,
    };
    const facts = {
      categoryId: 'cat-road',
      subcategoryId: 'sub-pothole',
      severity: Priority.HIGH,
      zoneId: 'zone-n',
      isEmergency: true,
    };
    expect(ruleMatches(rule, facts)).toBe(true);
    expect(ruleMatches(rule, { ...facts, severity: Priority.LOW })).toBe(false);
    expect(ruleMatches(rule, { ...facts, zoneId: 'zone-s' })).toBe(false);
    expect(ruleMatches(rule, { ...facts, isEmergency: false })).toBe(false);
  });
});

describe('ruleMatches — legacy', () => {
  it('treats null fields as wildcards', () => {
    expect(ruleMatches(base, { categoryId: 'any' })).toBe(true);
  });

  it('does not encode category names — only configured ids', () => {
    const rule = { ...base, categoryId: 'cat-waste' };
    expect(ruleMatches(rule, { categoryId: 'cat-waste' })).toBe(true);
    expect(ruleMatches(rule, { categoryId: 'cat-roads' })).toBe(false);
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
