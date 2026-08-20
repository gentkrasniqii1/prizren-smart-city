import { describe, expect, it } from 'vitest';
import {
  createReportFieldsSchema,
  isPasswordStrong,
  loginRequestSchema,
  passwordPolicyErrors,
  registerRequestSchema,
} from '@prizren/shared-types';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('passwordPolicyErrors', () => {
  it('matches isPasswordStrong', () => {
    expect(passwordPolicyErrors('Short1!').length).toBeGreaterThan(0);
    expect(isPasswordStrong('Short1!')).toBe(false);
    expect(passwordPolicyErrors('StrongPass1!')).toEqual([]);
    expect(isPasswordStrong('StrongPass1!')).toBe(true);
  });
});

describe('ZodValidationPipe', () => {
  it('rejects an invalid login body', () => {
    const pipe = new ZodValidationPipe(loginRequestSchema);
    expect(() => pipe.transform({ email: 'not-an-email', password: 'short' })).toThrow(
      /email must be a valid email|password must be at least 8 characters/,
    );
  });

  it('accepts a valid login body', () => {
    const pipe = new ZodValidationPipe(loginRequestSchema);
    const parsed = pipe.transform({
      email: '  citizen@example.com ',
      password: 'notchecked',
      rememberMe: false,
    });
    expect(parsed).toMatchObject({ email: 'citizen@example.com', password: 'notchecked' });
  });

  it('rejects a weak register password', () => {
    const pipe = new ZodValidationPipe(registerRequestSchema);
    expect(() =>
      pipe.transform({
        email: 'citizen@example.com',
        password: 'password',
        firstName: 'Ana',
        lastName: 'Kola',
        acceptedTerms: true,
      }),
    ).toThrow(/complexity/);
  });
});

describe('createReportFieldsSchema', () => {
  it('parses multipart-like strings', () => {
    const parsed = createReportFieldsSchema.parse({
      description: 'A pothole on the main road',
      lat: '42.213',
      lng: '20.739',
      address: '  ',
      categoryId: '',
    });
    expect(parsed.lat).toBeCloseTo(42.213);
    expect(parsed.address).toBeUndefined();
    expect(parsed.categoryId).toBeUndefined();
  });

  it('rejects a short description', () => {
    const result = createReportFieldsSchema.safeParse({
      description: 'too short',
      lat: 42,
      lng: 20,
    });
    expect(result.success).toBe(false);
  });
});
