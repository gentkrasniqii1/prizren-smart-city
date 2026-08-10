import { BadRequestException } from '@nestjs/common';
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from '../reports/dto/create-report.dto';

/**
 * Detect image MIME from magic bytes (not client Content-Type).
 * Supports JPEG, PNG, WebP — matches ALLOWED_IMAGE_MIME.
 */
export function detectImageMimeFromMagic(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

export async function assertValidImageUpload(file: Express.Multer.File): Promise<string> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('photo is required');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException('photo must be at most 5MB');
  }

  let mime = detectImageMimeFromMagic(file.buffer);

  // Optional secondary check via file-type (ESM) when available
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);
    if (detected?.mime) {
      mime = detected.mime;
    }
  } catch {
    // magic-byte detection above is sufficient
  }

  if (!mime || !ALLOWED_IMAGE_MIME.has(mime)) {
    throw new BadRequestException('photo must be a valid JPEG, PNG, or WebP image');
  }

  return mime;
}
