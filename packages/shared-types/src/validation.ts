import { z } from 'zod';
import { isPasswordStrong, PASSWORD_MAX, PASSWORD_MIN } from './password';

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const PHONE_MAX = 40;
export const HONEYPOT_MAX = 200;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 5000;
export const COMMENT_MAX = 2000;
export const TOKEN_MIN = 20;
export const ADDRESS_MAX = 300;

export const emailSchema = z.string().trim().min(1, 'emailRequired').pipe(z.email('emailInvalid'));

export const loginPasswordSchema = z
  .string()
  .min(1, 'passwordRequired')
  .min(PASSWORD_MIN, 'passwordMin')
  .max(PASSWORD_MAX);

export const strongPasswordSchema = z
  .string()
  .min(1, 'passwordRequired')
  .max(PASSWORD_MAX)
  .refine(isPasswordStrong, { message: 'passwordWeak' });

export const nameSchema = z.string().trim().min(NAME_MIN, 'nameMin').max(NAME_MAX);

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX)
  .optional()
  .transform((value) => (value ? value : undefined));

export const honeypotSchema = z.string().max(HONEYPOT_MAX).optional();

export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6,8}$/, 'twoFactorInvalid'));

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
  rememberMe: z.boolean().optional(),
  website: honeypotSchema,
});

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: optionalPhoneSchema,
  acceptedTerms: z.boolean().refine((value) => value === true, { message: 'termsRequired' }),
  website: honeypotSchema,
});

export const registerFormSchema = registerRequestSchema
  .extend({
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.password, {
    message: 'passwordMismatch',
    path: ['confirm'],
  });

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
  website: honeypotSchema,
});

export const resendVerificationRequestSchema = forgotPasswordRequestSchema;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(TOKEN_MIN),
  password: strongPasswordSchema,
});

export const resetPasswordFormSchema = z
  .object({
    password: strongPasswordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.password, {
    message: 'passwordMismatch',
    path: ['confirm'],
  });

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'currentPasswordRequired'),
  newPassword: strongPasswordSchema,
});

export const changePasswordFormSchema = changePasswordRequestSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.confirmPassword === data.newPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  });

export const twoFactorVerifyRequestSchema = z.object({
  challengeToken: z.string().min(TOKEN_MIN),
  code: totpCodeSchema,
  trustDevice: z.boolean().optional(),
});

export const twoFactorFormSchema = z.object({
  code: totpCodeSchema,
  trustDevice: z.boolean().optional(),
});

export const totpCodeRequestSchema = z.object({
  code: totpCodeSchema,
});

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(TOKEN_MIN),
});

export const updateProfileRequestSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: optionalPhoneSchema,
});

export const setAccountEmailRequestSchema = z.object({
  email: emailSchema,
});

export const completeFacebookRequestSchema = z.object({
  email: emailSchema,
  website: honeypotSchema,
});

export const createCommentRequestSchema = z.object({
  text: z.string().trim().min(1, 'commentRequired').max(COMMENT_MAX),
});

function parseCoord(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const createReportFieldsSchema = z.object({
  description: z.string().trim().min(DESCRIPTION_MIN, 'descriptionError').max(DESCRIPTION_MAX),
  lat: z.preprocess(parseCoord, z.number({ error: 'locationRequired' }).gte(-90).lte(90)),
  lng: z.preprocess(parseCoord, z.number({ error: 'locationRequired' }).gte(-180).lte(180)),
  address: z
    .string()
    .trim()
    .max(ADDRESS_MAX)
    .optional()
    .transform((value) => (value ? value : undefined)),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  subcategoryId: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    return typeof val === 'string' ? val.trim() : val;
  }, z.string().uuid().optional()),
  website: honeypotSchema,
});
