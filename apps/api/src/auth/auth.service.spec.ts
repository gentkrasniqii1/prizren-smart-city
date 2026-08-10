import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { PrismaService } from '../prisma/prisma.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async () => 'hashed-password'),
  compare: vi.fn(
    async (plain: string, hash: string) => plain === 'password123' && hash === 'hashed-password',
  ),
}));

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'citizen@test.local',
    name: 'Citizen',
    role: Role.CITIZEN,
    passwordHash: 'hashed-password',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('access-token'),
    };
    const config = {
      jwtAccessSecret: 'test-secret',
      refreshExpiresDays: 7,
    } as ConfigService;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config,
    );
  });

  it('registers a new citizen and returns tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);

    const result = await service.register({
      email: 'Citizen@test.local',
      password: 'password123',
      name: ' Citizen ',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'citizen@test.local',
          name: 'Citizen',
          role: Role.CITIZEN,
        }),
      }),
    );
    expect(result.auth.accessToken).toBe('access-token');
    expect(result.auth.user.email).toBe('citizen@test.local');
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejects duplicate email on register', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.register({
        email: 'citizen@test.local',
        password: 'password123',
        name: 'Citizen',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const result = await service.login({
      email: 'citizen@test.local',
      password: 'password123',
    });
    expect(result.auth.accessToken).toBe('access-token');
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@test.local', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.login({ email: 'citizen@test.local', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('maps users to PublicUser via toPublicUser', () => {
    expect(service.toPublicUser(user as never)).toEqual({
      id: 'user-1',
      email: 'citizen@test.local',
      name: 'Citizen',
      role: Role.CITIZEN,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
