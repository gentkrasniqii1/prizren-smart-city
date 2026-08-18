import { describe, expect, it } from 'vitest';
import { isTrustedMutationOrigin, parseAllowedOrigins, requestOrigin } from './csrf-origin';

describe('csrf-origin', () => {
  it('parses CORS allowlists and always includes the web origin', () => {
    expect(
      parseAllowedOrigins('http://localhost:3000, https://prizren.city', 'http://localhost:3000'),
    ).toEqual(['http://localhost:3000', 'https://prizren.city']);
  });

  it('prefers Origin over Referer', () => {
    expect(
      requestOrigin({
        headers: { origin: 'http://localhost:3000', referer: 'https://evil.example/x' },
      }),
    ).toBe('http://localhost:3000');
  });

  it('falls back to the Referer origin when Origin is omitted', () => {
    expect(
      requestOrigin({
        headers: { referer: 'http://localhost:3000/account' },
      }),
    ).toBe('http://localhost:3000');
  });

  it('rejects unknown origins in production', () => {
    expect(isTrustedMutationOrigin('https://evil.example', ['http://localhost:3000'], true)).toBe(
      false,
    );
  });

  it('rejects a missing origin in production', () => {
    expect(isTrustedMutationOrigin(null, ['http://localhost:3000'], true)).toBe(false);
  });

  it('allows a missing origin outside production', () => {
    expect(isTrustedMutationOrigin(null, ['http://localhost:3000'], false)).toBe(true);
  });
});
