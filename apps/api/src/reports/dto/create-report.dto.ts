import { BadRequestException, PipeTransform, Injectable } from '@nestjs/common';

export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ParseCreateReportFieldsPipe implements PipeTransform {
  transform(value: Record<string, unknown>) {
    const description = String(value.description ?? '').trim();
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    const address = value.address ? String(value.address).trim() : undefined;
    const categoryId = value.categoryId ? String(value.categoryId).trim() : undefined;
    const website = value.website != null ? String(value.website) : undefined;

    if (!description || description.length < 10) {
      throw new BadRequestException('description must be at least 10 characters');
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('lat must be a valid latitude');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('lng must be a valid longitude');
    }

    return {
      description,
      lat,
      lng,
      address: address || undefined,
      categoryId: categoryId || undefined,
      website,
    };
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
