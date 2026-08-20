import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

const API_ISSUE_MESSAGES: Record<string, string> = {
  emailRequired: 'email is required',
  emailInvalid: 'email must be a valid email',
  passwordRequired: 'password is required',
  passwordMin: 'password must be at least 8 characters',
  passwordWeak: 'password does not meet complexity requirements',
  passwordMismatch: 'passwords do not match',
  nameMin: 'name must be at least 2 characters',
  termsRequired: 'acceptedTerms must be true',
  twoFactorInvalid: 'code must be 6–8 digits',
  descriptionError: 'description must be at least 10 characters',
  locationRequired: 'lat/lng invalid',
  photoRequired: 'photo is required',
  commentRequired: 'text must be at least 1 character',
  currentPasswordRequired: 'currentPassword is required',
};

export function zodIssueToApiMessage(message: string | undefined): string {
  if (!message) return 'Validation failed';
  return API_ISSUE_MESSAGES[message] ?? message;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new BadRequestException(zodIssueToApiMessage(result.error.issues[0]?.message));
  }
}

export function zodBody(schema: z.ZodType) {
  return new ZodValidationPipe(schema);
}
