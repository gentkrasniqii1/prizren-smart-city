import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES } from '../reports/dto/create-report.dto';
import { assertValidImageUpload, detectImageMimeFromMagic } from './image-validation';

function jpegBuffer(extra = 0): Buffer {
  const buf = Buffer.alloc(12 + extra, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function webpBuffer(): Buffer {
  const buf = Buffer.alloc(12, 0);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

describe('detectImageMimeFromMagic', () => {
  it('detects JPEG, PNG, and WebP signatures', () => {
    expect(detectImageMimeFromMagic(jpegBuffer())).toBe('image/jpeg');
    expect(detectImageMimeFromMagic(pngBuffer())).toBe('image/png');
    expect(detectImageMimeFromMagic(webpBuffer())).toBe('image/webp');
  });

  it('returns null for short or non-image buffers', () => {
    expect(detectImageMimeFromMagic(Buffer.from('hello'))).toBeNull();
    expect(detectImageMimeFromMagic(Buffer.alloc(4))).toBeNull();
  });
});

describe('assertValidImageUpload', () => {
  it('accepts a JPEG-looking upload', async () => {
    const buffer = jpegBuffer(100);
    const mime = await assertValidImageUpload({
      buffer,
      size: buffer.length,
      mimetype: 'image/gif',
      originalname: 'x.jpg',
      fieldname: 'photo',
    } as Express.Multer.File);
    expect(mime).toBe('image/jpeg');
  });

  it('rejects empty files', async () => {
    await expect(
      assertValidImageUpload({
        buffer: Buffer.alloc(0),
        size: 0,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized files', async () => {
    const buffer = jpegBuffer();
    await expect(
      assertValidImageUpload({
        buffer,
        size: MAX_IMAGE_BYTES + 1,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects buffers that are not real images even if MIME claims jpeg', async () => {
    const buffer = Buffer.from('not-an-image!!!!!!');
    await expect(
      assertValidImageUpload({
        buffer,
        size: buffer.length,
        mimetype: 'image/jpeg',
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
