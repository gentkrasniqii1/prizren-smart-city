import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(async () => 'hashed-password'),
  compare: vi.fn(
    async (plain: string, hash: string) => plain === 'Password1!' && hash === 'hashed-password',
  ),
}));

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'citizen@test.local',
    name: 'Citizen Test',
    firstName: 'Citizen',
    lastName: 'Test',
    phone: null,
    role: Role.CITIZEN,
    passwordHash: 'hashed-password',
    emailVerified: true,
    totpEnabled: false,
    totpSecretEnc: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    authToken: {
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let mail: {
    sendVerificationEmail: ReturnType<typeof vi.fn>;
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
    sendPasswordChangedEmail: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      authToken: {
        create: vi.fn().mockResolvedValue({ id: 'at-1' }),
        updateMany: vi.fn(),
      },
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('access-token'),
    };
    mail = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
    };
    const config = {
      jwtAccessSecret: 'test-secret',
      refreshExpiresDays: 7,
      rememberMeExpiresDays: 30,
      encryptionKey: 'test-key',
      requireAdmin2fa: false,
      webOrigin: 'http://localhost:3000',
    } as ConfigService;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config,
      mail as unknown as MailService,
    );
  });

  it('registers a new citizen and sends verification email without issuing a session', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...user, emailVerified: false });

    const result = await service.register({
      email: 'Citizen@test.local',
      password: 'Password1!',
      firstName: 'Citizen',
      lastName: 'Test',
      acceptedTerms: true,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'citizen@test.local',
          name: 'Citizen Test',
          role: Role.CITIZEN,
          emailVerified: false,
        }),
      }),
    );
    expect(result.requiresEmailVerification).toBe(true);
    expect(mail.sendVerificationEmail).toHaveBeenCalled();
  });

  it('rejects duplicate email on register', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.register({
        email: 'citizen@test.local',
        password: 'Password1!',
        firstName: 'Citizen',
        lastName: 'Test',
        acceptedTerms: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    const result = await service.login({
      email: 'citizen@test.local',
      password: 'Password1!',
    });
    expect(result.kind).toBe('auth');
    if (result.kind === 'auth') {
      expect(result.auth.accessToken).toBe('access-token');
    }
  });

  it('rejects unverified email on login', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, emailVerified: false });
    await expect(
      service.login({ email: 'citizen@test.local', password: 'Password1!' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid login credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@test.local', password: 'Password1!' }),
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
      name: 'Citizen Test',
      firstName: 'Citizen',
      lastName: 'Test',
      phone: null,
      role: Role.CITIZEN,
      emailVerified: true,
      totpEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
