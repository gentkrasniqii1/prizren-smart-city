import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.configured = Boolean(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      this.logger.warn(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.',
      );
    }
  }

  async uploadImage(buffer: Buffer, filename: string): Promise<string> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured. Add credentials to apps/api/.env',
      );
    }

    return new Promise((resolve, reject) => {
      // Keep unsigned public `secure_url` delivery. Official case pages (Phase 8)
      // must fetch INITIAL/AFTER photos without a signed cookie. STAFF/ATTACHMENT
      // rows are omitted from the public DTO, but a leaked URL stays fetchable —
      // switching to private/signed delivery would break public evidence.
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER ?? 'prizren-reports',
          resource_type: 'image',
          public_id: filename.replace(/\.[^.]+$/, ''),
          overwrite: false,
        },
        (error, result: UploadApiResponse | undefined) => {
          if (error || !result?.secure_url) {
            const message =
              error && typeof error === 'object' && 'message' in error
                ? String((error as { message: string }).message)
                : 'Cloudinary upload failed';
            reject(new BadRequestException(`Photo upload failed: ${message}`));
            return;
          }
          resolve(result.secure_url);
        },
      );

      Readable.from(buffer).pipe(upload);
    });
  }
}
