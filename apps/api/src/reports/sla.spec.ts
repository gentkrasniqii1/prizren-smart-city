import { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computeDueAt, computeDueAtFromHours, DUE_SOON_MS, slaBucket } from './sla';

describe('computeDueAt', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');

  it('uses MEDIUM (3 days) when priority is missing', () => {
    const due = computeDueAt(null, from);
    expect(due.toISOString()).toBe('2026-01-04T00:00:00.000Z');
  });

  it('applies CRITICAL and HIGH windows', () => {
    expect(computeDueAt(Priority.CRITICAL, from).toISOString()).toBe('2026-01-01T04:00:00.000Z');
    expect(computeDueAt(Priority.HIGH, from).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('applies a configured SLA window in hours', () => {
    const due = computeDueAtFromHours(48, from);
    expect(due.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });
});

describe('slaBucket', () => {
  const now = new Date('2026-01-10T12:00:00.000Z');

  it('returns null without dueAt', () => {
    expect(slaBucket(null, now)).toBeNull();
  });

  it('classifies overdue / due_soon / on_time', () => {
    expect(slaBucket(new Date('2026-01-10T11:00:00.000Z'), now)).toBe('overdue');
    expect(slaBucket(new Date(now.getTime() + DUE_SOON_MS / 2), now)).toBe('due_soon');
    expect(slaBucket(new Date(now.getTime() + DUE_SOON_MS * 2), now)).toBe('on_time');
  });
});
