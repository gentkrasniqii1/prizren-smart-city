import { BadRequestException, PipeTransform, Injectable } from '@nestjs/common';
import { createReportFieldsSchema } from '@prizren/shared-types';
import { zodIssueToApiMessage } from '../../common/zod-validation.pipe';

export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REPORT_PHOTOS = 5;

@Injectable()
export class ParseCreateReportFieldsPipe implements PipeTransform {
  transform(value: Record<string, unknown>) {
    const result = createReportFieldsSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(zodIssueToApiMessage(result.error.issues[0]?.message));
    }
    return result.data;
  }
}

export type CreateReportFields = {
  description: string;
  lat: number;
  lng: number;
  address?: string;
  categoryId?: string;
  /** Honeypot — must stay empty. */
  website?: string;
};
