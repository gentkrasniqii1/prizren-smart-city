import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { USER_AVATAR_UPDATED_EVENT } from '../events/status-changed.event';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../uploads/cloudinary.service';
import { MAX_IMAGE_BYTES } from '../reports/dto/create-report.dto';
import { UsersService } from './users.service';

function jpegFile(size?: number): Express.Multer.File {
  const extra = Math.max(0, (size ?? 64) - 12);
  const buffer = Buffer.alloc(12 + extra, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/jpeg',
    originalname: 'me.jpg',
    fieldname: 'avatar',
  } as Express.Multer.File;
}

function pngFile(): Express.Multer.File {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/png',
    originalname: 'me.png',
    fieldname: 'avatar',
  } as Express.Multer.File;
}

function webpFile(): Express.Multer.File {
  const buffer = Buffer.alloc(12, 0);
  buffer.write('RIFF', 0, 'ascii');
  buffer.write('WEBP', 8, 'ascii');
  return {
    buffer,
    size: buffer.length,
    mimetype: 'image/webp',
    originalname: 'me.webp',
    fieldname: 'avatar',
  } as Express.Multer.File;
}

const userRow = {
  id: 'user-1',
  email: 'citizen@test.local',
  name: 'Citizen Test',
  firstName: 'Citizen',
  lastName: 'Test',
  phone: null,
  role: Role.CITIZEN,
  passwordHash: 'hashed',
  emailVerified: true,
  totpEnabled: false,
  googleId: null,
  facebookId: null,
  avatarUrl: null as string | null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService avatars', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const cloudinary = { uploadImage: vi.fn() };
  const events = { emit: vi.fn() };
  const authService = {
    toPublicUser: vi.fn((u: typeof userRow) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
    })),
  };

  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
      authService as unknown as AuthService,
      events as unknown as EventEmitter2,
    );
  });

  it('uploads a JPEG avatar via Cloudinary and emits a realtime event', async () => {
    const url = 'https://res.cloudinary.com/demo/prizren-avatars/avatar-user-1.jpg';
    cloudinary.uploadImage.mockResolvedValue(url);
    prisma.user.update.mockResolvedValue({ ...userRow, avatarUrl: url });

    const result = await service.updateAvatar('user-1', jpegFile());

    expect(cloudinary.uploadImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'avatar-user-1',
      expect.objectContaining({ folder: 'prizren-avatars', overwrite: true }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: url },
    });
    expect(events.emit).toHaveBeenCalledWith(
      USER_AVATAR_UPDATED_EVENT,
      expect.objectContaining({ userId: 'user-1', avatarUrl: url }),
    );
    expect(result.avatarUrl).toBe(url);
  });

  it('uploads a PNG avatar', async () => {
    const url = 'https://res.cloudinary.com/demo/prizren-avatars/avatar-user-1.png';
    cloudinary.uploadImage.mockResolvedValue(url);
    prisma.user.update.mockResolvedValue({ ...userRow, avatarUrl: url });
    await expect(service.updateAvatar('user-1', pngFile())).resolves.toMatchObject({
      avatarUrl: url,
    });
  });

  it('rejects WebP even though report photos allow it', async () => {
    await expect(service.updateAvatar('user-1', webpFile())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('rejects oversized files', async () => {
    const file = jpegFile(32);
    file.size = MAX_IMAGE_BYTES + 1;
    await expect(service.updateAvatar('user-1', file)).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('rejects empty uploads', async () => {
    await expect(
      service.updateAvatar('user-1', {
        buffer: Buffer.alloc(0),
        size: 0,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears avatarUrl and emits a removal event', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userRow, avatarUrl: 'https://old' });
    prisma.user.update.mockResolvedValue({ ...userRow, avatarUrl: null });

    const result = await service.removeAvatar('user-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: null },
    });
    expect(events.emit).toHaveBeenCalledWith(
      USER_AVATAR_UPDATED_EVENT,
      expect.objectContaining({ userId: 'user-1', avatarUrl: null }),
    );
    expect(result.avatarUrl).toBeNull();
  });

  it('throws when removing an avatar for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.removeAvatar('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
