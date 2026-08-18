import { describe, expect, it } from 'vitest';
import { timingSafeEqualString } from './crypto';

describe('timingSafeEqualString', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualString('google.abc.nonce', 'google.abc.nonce')).toBe(true);
  });

  it('returns false for different values of the same length', () => {
    expect(timingSafeEqualString('aaaa', 'aaab')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeEqualString('short', 'much-longer')).toBe(false);
  });
});
