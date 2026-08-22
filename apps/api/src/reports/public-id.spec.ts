import { describe, expect, it, vi } from 'vitest';
import {
  formatPublicId,
  isReportPublicId,
  nextReportPublicId,
  reportWhereByRef,
} from './public-id';

describe('formatPublicId', () => {
  it('zero-pads the sequence to 6 digits', () => {
    expect(formatPublicId(2026, 1)).toBe('PRZ-2026-000001');
    expect(formatPublicId(2026, 184)).toBe('PRZ-2026-000184');
  });

  it('does not truncate sequences beyond 6 digits', () => {
    expect(formatPublicId(2026, 1234567)).toBe('PRZ-2026-1234567');
  });
});

describe('reportWhereByRef', () => {
  it('treats a publicId as a publicId lookup', () => {
    expect(isReportPublicId('PRZ-2026-000001')).toBe(true);
    expect(reportWhereByRef('prz-2026-000001')).toEqual({ publicId: 'PRZ-2026-000001' });
    expect(reportWhereByRef('PRZ-2026-1234567')).toEqual({ publicId: 'PRZ-2026-1234567' });
  });

  it('treats everything else as a report id, including unit-test stubs', () => {
    expect(isReportPublicId('r1')).toBe(false);
    expect(reportWhereByRef('r1')).toEqual({ id: 'r1' });
    expect(reportWhereByRef('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toEqual({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
  });
});

describe('nextReportPublicId', () => {
  function fakeTx(initialValue: number) {
    let value = initialValue;
    const upsert = vi.fn().mockImplementation(() => {
      value += 1;
      return Promise.resolve({ id: `report-2026`, value });
    });
    return { tx: { sequenceCounter: { upsert } } as never, upsert };
  }

  it('allocates sequence 1 for a brand-new year counter', async () => {
    const { tx } = fakeTx(0);
    const publicId = await nextReportPublicId(tx, new Date('2026-03-01T00:00:00.000Z'));
    expect(publicId).toBe('PRZ-2026-000001');
  });

  it('continues from the existing counter value', async () => {
    const { tx } = fakeTx(7);
    const publicId = await nextReportPublicId(tx, new Date('2026-03-01T00:00:00.000Z'));
    expect(publicId).toBe('PRZ-2026-000008');
  });

  it('scopes the counter key to the report year', async () => {
    const { tx, upsert } = fakeTx(0);
    await nextReportPublicId(tx, new Date('2027-01-01T00:00:00.000Z'));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'report-2027' } }));
  });
});
