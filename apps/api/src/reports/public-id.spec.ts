import { describe, expect, it, vi } from 'vitest';
import { formatPublicId, nextReportPublicId } from './public-id';

describe('formatPublicId', () => {
  it('zero-pads the sequence to 6 digits', () => {
    expect(formatPublicId(2026, 1)).toBe('PRZ-2026-000001');
    expect(formatPublicId(2026, 184)).toBe('PRZ-2026-000184');
  });

  it('does not truncate sequences beyond 6 digits', () => {
    expect(formatPublicId(2026, 1234567)).toBe('PRZ-2026-1234567');
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
