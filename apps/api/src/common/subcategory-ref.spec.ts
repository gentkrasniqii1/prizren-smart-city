import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { normalizeSubcategoryName, resolveActiveSubcategory } from './subcategory-ref';

describe('normalizeSubcategoryName', () => {
  it('trims a valid name', () => {
    expect(normalizeSubcategoryName('  Gropa  ')).toBe('Gropa');
  });

  it('rejects empty string', () => {
    expect(() => normalizeSubcategoryName('')).toThrow(BadRequestException);
  });

  it('rejects whitespace-only', () => {
    expect(() => normalizeSubcategoryName('   ')).toThrow(BadRequestException);
  });
});

describe('resolveActiveSubcategory', () => {
  it('returns null when subcategoryId is missing', async () => {
    const prisma = { subcategory: { findUnique: vi.fn() } };
    await expect(
      resolveActiveSubcategory(prisma as never, { subcategoryId: null, categoryId: 'c1' }),
    ).resolves.toBeNull();
    expect(prisma.subcategory.findUnique).not.toHaveBeenCalled();
  });

  it('resolves an active subcategory under the category', async () => {
    const prisma = {
      subcategory: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sub-1',
          name: 'Gropa',
          categoryId: 'cat-a',
          active: true,
        }),
      },
    };
    await expect(
      resolveActiveSubcategory(prisma as never, {
        subcategoryId: 'sub-1',
        categoryId: 'cat-a',
      }),
    ).resolves.toEqual({
      subcategoryId: 'sub-1',
      subcategory: 'Gropa',
      categoryId: 'cat-a',
    });
  });

  it('rejects nonexistent subcategory', async () => {
    const prisma = { subcategory: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      resolveActiveSubcategory(prisma as never, { subcategoryId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive subcategory', async () => {
    const prisma = {
      subcategory: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sub-1',
          name: 'Gropa',
          categoryId: 'cat-a',
          active: false,
        }),
      },
    };
    await expect(
      resolveActiveSubcategory(prisma as never, { subcategoryId: 'sub-1', categoryId: 'cat-a' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects subcategory belonging to another category', async () => {
    const prisma = {
      subcategory: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sub-1',
          name: 'Gropa',
          categoryId: 'cat-a',
          active: true,
        }),
      },
    };
    await expect(
      resolveActiveSubcategory(prisma as never, {
        subcategoryId: 'sub-1',
        categoryId: 'cat-b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
