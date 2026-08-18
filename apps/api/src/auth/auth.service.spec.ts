import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { sha256Hex } from './crypto';
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
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
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
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    trustedDevice: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };
  let mail: {
    sendVerificationEmail: ReturnType<typeof vi.fn>;
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
    sendPasswordChangedEmail: ReturnType<typeof vi.fn>;
    sendSuspiciousLoginEmail: ReturnType<typeof vi.fn>;
    sendAccountLockedEmail: ReturnType<typeof vi.fn>;
  };
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
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
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      trustedDevice: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('access-token'),
    };
    mail = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
      sendSuspiciousLoginEmail: vi.fn().mockResolvedValue(undefined),
      sendAccountLockedEmail: vi.fn().mockResolvedValue(undefined),
    };
    audit = { log: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
    const config = {
      jwtAccessSecret: 'test-secret',
      jwtAccessExpiresIn: '15m',
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
      audit as never,
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
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_FAILED', userId: 'user-1' }),
    );
  });

  it('locks the account after too many failed logins and emails the user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, failedLoginCount: 9 });
    await expect(
      service.login({ email: 'citizen@test.local', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginCount: 10, lockedUntil: expect.any(Date) }),
      }),
    );
    expect(mail.sendAccountLockedEmail).toHaveBeenCalledWith('citizen@test.local');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_LOCKED' }));
  });

  it('emails the user when a successful login comes from a new IP', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, lastLoginIp: '1.1.1.1' });
    prisma.user.update.mockResolvedValue(user);
    const result = await service.login(
      { email: 'citizen@test.local', password: 'Password1!' },
      undefined,
      { ip: '8.8.8.8', userAgent: 'vitest' },
    );
    expect(result.kind).toBe('auth');
    expect(mail.sendSuspiciousLoginEmail).toHaveBeenCalledWith('citizen@test.local', {
      ip: '8.8.8.8',
      userAgent: 'vitest',
    });
  });

  describe('loginWithOAuth', () => {
    it('auto-links a verified Google profile to an existing password account', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // no user with this googleId yet
      prisma.user.findUnique.mockResolvedValue({ ...user, googleId: null }); // matched by email
      prisma.user.update.mockResolvedValue({ ...user, googleId: 'google-sub-1' });

      const result = await service.loginWithOAuth({
        provider: 'google',
        providerId: 'google-sub-1',
        email: 'citizen@test.local',
        name: 'Citizen Test',
        emailVerified: true,
      });

      expect(result.linkedAccount).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ googleId: 'google-sub-1' }),
        }),
      );
    });

    it('does not report a link on a subsequent login with the already-linked googleId', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...user, googleId: 'google-sub-1' });

      const result = await service.loginWithOAuth({
        provider: 'google',
        providerId: 'google-sub-1',
        email: 'citizen@test.local',
        name: 'Citizen Test',
        emailVerified: true,
      });

      expect(result.linkedAccount).toBe(false);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when the email is already linked to a different googleId', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...user, googleId: 'other-google-sub' });

      await expect(
        service.loginWithOAuth({
          provider: 'google',
          providerId: 'google-sub-1',
          email: 'citizen@test.local',
          name: 'Citizen Test',
          emailVerified: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('still rejects non-Google providers matching an existing password account', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ ...user, facebookId: null });

      await expect(
        service.loginWithOAuth({
          provider: 'facebook',
          providerId: 'fb-sub-1',
          email: 'citizen@test.local',
          name: 'Citizen Test',
          emailVerified: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('changes the password and revokes existing sessions', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      const result = await service.changePassword('user-1', 'Password1!', 'NewPassw0rd!');

      expect(result).toEqual({ ok: true });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
      );
      expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith('citizen@test.local');
    });

    it('rejects when the current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(
        service.changePassword('user-1', 'wrong-password', 'NewPassw0rd!'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a weak new password', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.changePassword('user-1', 'Password1!', 'weak')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when the new password matches the current one', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(
        service.changePassword('user-1', 'Password1!', 'Password1!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects accounts without a password (OAuth-only)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: null });
      await expect(
        service.changePassword('user-1', 'anything', 'NewPassw0rd!'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
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
      hasPassword: true,
      googleLinked: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('reports googleLinked: true for a user with a linked Google account', () => {
    expect(service.toPublicUser({ ...user, googleId: 'google-sub-1' } as never)).toMatchObject({
      googleLinked: true,
    });
  });

  describe('forgotPassword', () => {
    it('generates and hashes a reset token, and sends the reset email for an existing user', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.forgotPassword('citizen@test.local');

      expect(result).toEqual({ ok: true });
      expect(prisma.authToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.authToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: AuthTokenType.PASSWORD_RESET,
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
      // Only a hash is ever persisted, never the raw token.
      const stored = prisma.authToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).toHaveLength(64); // sha256 hex digest
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        'citizen@test.local',
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('returns the same generic response for an unknown email and sends no mail', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@test.local');

      expect(result).toEqual({ ok: true });
      expect(prisma.authToken.create).not.toHaveBeenCalled();
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const rawToken = 'a'.repeat(48);
    const tokenRow = {
      id: 'at-1',
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      user,
    };

    it('resets the password, marks the token used, and revokes active sessions', async () => {
      prisma.authToken.findUnique.mockResolvedValue(tokenRow);
      prisma.user.update.mockResolvedValue(user);

      const result = await service.resetPassword(rawToken, 'NewPassw0rd!');

      expect(result).toEqual({ ok: true });
      expect(prisma.authToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256Hex(rawToken) },
        include: { user: true },
      });
      // Single-use: the token is consumed before the password is changed.
      expect(prisma.authToken.update).toHaveBeenCalledWith({
        where: { id: 'at-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mail.sendPasswordChangedEmail).toHaveBeenCalledWith('citizen@test.local');
    });

    it('rejects an unknown token', async () => {
      prisma.authToken.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword(rawToken, 'NewPassw0rd!')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an already-used token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({ ...tokenRow, usedAt: new Date() });
      await expect(service.resetPassword(rawToken, 'NewPassw0rd!')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.authToken.findUnique.mockResolvedValue({
        ...tokenRow,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.resetPassword(rawToken, 'NewPassw0rd!')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a weak new password before consuming the token', async () => {
      await expect(service.resetPassword(rawToken, 'weak')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.authToken.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('revokes every active refresh token and trusted device for the user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
      await service.logoutAll('user-1');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.trustedDevice.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
