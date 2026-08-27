import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PublicUser } from '@prizren/shared-types';
import { AuthService } from '../auth/auth.service';
import { USER_AVATAR_UPDATED_EVENT, UserAvatarUpdatedEvent } from '../events/status-changed.event';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { assertValidImageUpload } from '../uploads/image-validation';

const AVATAR_MIMES = new Set(['image/jpeg', 'image/png']);

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly authService: AuthService,
    private readonly events: EventEmitter2,
  ) {}

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<PublicUser> {
    const mime = await assertValidImageUpload(file);
    if (!AVATAR_MIMES.has(mime)) {
      throw new BadRequestException('avatar must be a JPEG or PNG image');
    }

    const url = await this.cloudinary.uploadImage(file.buffer, `avatar-${userId}`, {
      folder: process.env.CLOUDINARY_AVATAR_FOLDER ?? 'prizren-avatars',
      overwrite: true,
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    this.events.emit(USER_AVATAR_UPDATED_EVENT, new UserAvatarUpdatedEvent(userId, url));
    return this.authService.toPublicUser(updated);
  }

  async removeAvatar(userId: string): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    this.events.emit(USER_AVATAR_UPDATED_EVENT, new UserAvatarUpdatedEvent(userId, null));
    return this.authService.toPublicUser(updated);
  }
}
