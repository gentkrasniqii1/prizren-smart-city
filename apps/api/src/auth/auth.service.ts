import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateSecret, generateURI, verify } from 'otplib';
import type { AuthResponse, PublicUser, RegisterResponse } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from './config.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  decryptSecret,
  encryptSecret,
  passwordPolicyErrors,
  randomToken,
  sha256Hex,
} from './crypto';
import type { OAuthProfile, OAuthProvider } from './oauth.service';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const VERIFY_HOURS = 24;
const RESET_HOURS = 1;
const TWO_FACTOR_MINUTES = 10;

const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    if (!dto.acceptedTerms) {
      throw new BadRequestException('You must accept the Privacy Policy and Terms of Service');
    }
    const policy = passwordPolicyErrors(dto.password);
    if (policy.length > 0) {
      throw new BadRequestException(`Password does not meet requirements: ${policy.join(', ')}`);
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: Role.CITIZEN,
        emailVerified: false,
      },
    });

    const verifyToken = await this.issueEmailVerification(user);
    return {
      ok: true,
      email: user.email,
      requiresEmailVerification: true,
      ...(!this.mail.configured && !this.config.isProduction
        ? { devVerifyToken: verifyToken }
        : {}),
    };
  }

  async login(
    dto: LoginDto,
  ): Promise<
    | { kind: 'auth'; auth: AuthResponse; refreshToken: string; refreshDays: number }
    | { kind: '2fa'; challengeToken: string }
  > {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    if (!user?.passwordHash) {
      await this.dummyCompare();
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.recordFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    if (user.totpEnabled) {
      const challengeToken = await this.createAuthToken(user.id, AuthTokenType.TWO_FACTOR, {
        minutes: TWO_FACTOR_MINUTES,
      });
      return { kind: '2fa', challengeToken };
    }

    if (this.config.requireAdmin2fa && STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('TWO_FACTOR_REQUIRED');
    }

    const refreshDays = dto.rememberMe
      ? this.config.rememberMeExpiresDays
      : this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    return { kind: 'auth', ...issued, refreshDays };
  }

  async verifyTwoFactorLogin(
    challengeToken: string,
    code: string,
  ): Promise<{ auth: AuthResponse; refreshToken: string; refreshDays: number }> {
    const user = await this.consumeAuthToken(challengeToken, AuthTokenType.TWO_FACTOR);
    if (!user.totpEnabled || !user.totpSecretEnc) {
      throw new UnauthorizedException('Two-factor authentication is not enabled');
    }
    const secret = decryptSecret(user.totpSecretEnc, this.config.encryptionKey);
    const totp = await verify({ secret, token: code.replace(/\s/g, '') });
    if (!totp.valid) {
      throw new UnauthorizedException('Invalid verification code');
    }
    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    return { ...issued, refreshDays };
  }

  async loginWithOAuth(profile: OAuthProfile): Promise<{
    auth: AuthResponse;
    refreshToken: string;
    refreshDays: number;
    linkedAccount: boolean;
  }> {
    const providerIdField = this.providerIdField(profile.provider);
    let user = await this.prisma.user.findFirst({
      where: { [providerIdField]: profile.providerId },
    });

    let linkedAccount = false;

    if (!user && profile.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase().trim() },
      });
      if (byEmail) {
        const existingProviderId = byEmail[providerIdField];
        // Email matches an existing account, but it's already linked to a
        // *different* provider account (rare — e.g. a stale/changed provider id).
        if (existingProviderId && existingProviderId !== profile.providerId) {
          throw new ConflictException('ACCOUNT_EXISTS_PASSWORD');
        }

        const hasPassword = Boolean(byEmail.passwordHash);
        // Google verifies the email address itself, so it's safe to auto-link
        // an existing password account without an extra confirmation step.
        const canAutoLink = hasPassword && profile.provider === 'google' && profile.emailVerified;

        if (hasPassword && !existingProviderId && !canAutoLink) {
          throw new ConflictException('ACCOUNT_EXISTS_PASSWORD');
        }

        linkedAccount = canAutoLink;

        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            [providerIdField]: profile.providerId,
            emailVerified: true,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          },
        });
      }
    }

    if (!user) {
      if (!profile.email) {
        throw new BadRequestException('EMAIL_REQUIRED');
      }
      user = await this.prisma.user.create({
        data: {
          email: profile.email.toLowerCase().trim(),
          name: profile.name.trim() || profile.email.split('@')[0],
          [providerIdField]: profile.providerId,
          role: Role.CITIZEN,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });
    }

    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    return { ...issued, refreshDays, linkedAccount };
  }

  async requestEmailVerification(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user && !user.emailVerified) {
      await this.issueEmailVerification(user);
    }
    return { ok: true };
  }

  async verifyEmail(
    rawToken: string,
  ): Promise<{ auth: AuthResponse; refreshToken: string; refreshDays: number }> {
    const user = await this.consumeAuthToken(rawToken, AuthTokenType.EMAIL_VERIFY);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(updated, refreshDays);
    return { ...issued, refreshDays };
  }

  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user) {
      await this.prisma.authToken.updateMany({
        where: { userId: user.id, type: AuthTokenType.PASSWORD_RESET, usedAt: null },
        data: { usedAt: new Date() },
      });
      const raw = await this.createAuthToken(user.id, AuthTokenType.PASSWORD_RESET, {
        hours: RESET_HOURS,
      });
      const resetUrl = `${this.config.webOrigin}/reset-password?token=${encodeURIComponent(raw)}`;
      await this.mail.sendPasswordResetEmail(user.email, resetUrl);
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, password: string): Promise<{ ok: true }> {
    const policy = passwordPolicyErrors(password);
    if (policy.length > 0) {
      throw new BadRequestException(`Password does not meet requirements: ${policy.join(', ')}`);
    }
    const user = await this.consumeAuthToken(rawToken, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.notifyPasswordChanged(user.email);
    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account signs in with a provider (Google/Apple/Facebook) and has no password. Use "Forgot password" to set one.',
      );
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const policy = passwordPolicyErrors(newPassword);
    if (policy.length > 0) {
      throw new BadRequestException(`Password does not meet requirements: ${policy.join(', ')}`);
    }
    const unchanged = await bcrypt.compare(newPassword, user.passwordHash);
    if (unchanged) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.notifyPasswordChanged(user.email);
    return { ok: true };
  }

  async startTotpSetup(userId: string): Promise<{ otpauthUrl: string; secret: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = generateSecret();
    const enc = encryptSecret(secret, this.config.encryptionKey);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: enc, totpEnabled: false },
    });
    const otpauthUrl = generateURI({
      issuer: 'Prizren Smart City',
      label: user.email,
      secret,
    });
    return { otpauthUrl, secret };
  }

  async confirmTotpSetup(userId: string, code: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecretEnc) {
      throw new BadRequestException('Two-factor setup has not been started');
    }
    const secret = decryptSecret(user.totpSecretEnc, this.config.encryptionKey);
    const result = await verify({ secret, token: code.replace(/\s/g, '') });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { ok: true };
  }

  async disableTotp(userId: string, code: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecretEnc || !user.totpEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    const secret = decryptSecret(user.totpSecretEnc, this.config.encryptionKey);
    const result = await verify({ secret, token: code.replace(/\s/g, '') });
    if (!result.valid) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecretEnc: null },
    });
    return { ok: true };
  }

  async refresh(rawToken: string | undefined): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshDays: number;
    persistent: boolean;
  }> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = sha256Hex(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const remainingMs = stored.expiresAt.getTime() - Date.now();
    const remainingDays = Math.max(1, Math.ceil(remainingMs / dayMs));

    // The original refresh token's total lifetime tells us whether "remember me" was
    // checked at login (there's no separate column for it), so rotation keeps the
    // same cookie persistence instead of silently upgrading/downgrading the session.
    const totalDays = (stored.expiresAt.getTime() - stored.createdAt.getTime()) / dayMs;
    const midpointDays = (this.config.refreshExpiresDays + this.config.rememberMeExpiresDays) / 2;
    const persistent = totalDays > midpointDays;

    const accessToken = await this.signAccessToken(stored.user);
    const refreshToken = await this.createRefreshToken(stored.user.id, remainingDays);
    return { accessToken, refreshToken, refreshDays: remainingDays, persistent };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    const tokenHash = sha256Hex(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      totpEnabled: user.totpEnabled,
      hasPassword: Boolean(user.passwordHash),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private providerIdField(provider: OAuthProvider): 'googleId' | 'appleId' | 'facebookId' {
    if (provider === 'google') return 'googleId';
    if (provider === 'apple') return 'appleId';
    return 'facebookId';
  }

  private async issueEmailVerification(user: User): Promise<string> {
    await this.prisma.authToken.updateMany({
      where: { userId: user.id, type: AuthTokenType.EMAIL_VERIFY, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = await this.createAuthToken(user.id, AuthTokenType.EMAIL_VERIFY, {
      hours: VERIFY_HOURS,
    });
    const verifyUrl = `${this.config.webOrigin}/verify-email?token=${encodeURIComponent(raw)}`;
    await this.mail.sendVerificationEmail(user.email, verifyUrl);
    return raw;
  }

  private async createAuthToken(
    userId: string,
    type: AuthTokenType,
    ttl: { hours?: number; minutes?: number },
  ): Promise<string> {
    const raw = randomToken(48);
    const expiresAt = new Date();
    if (ttl.hours) expiresAt.setHours(expiresAt.getHours() + ttl.hours);
    if (ttl.minutes) expiresAt.setMinutes(expiresAt.getMinutes() + ttl.minutes);
    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256Hex(raw),
        expiresAt,
      },
    });
    return raw;
  }

  private async consumeAuthToken(rawToken: string, type: AuthTokenType): Promise<User> {
    if (!rawToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const stored = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      include: { user: true },
    });
    if (
      !stored ||
      stored.type !== type ||
      stored.usedAt ||
      stored.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    await this.prisma.authToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    return stored.user;
  }

  private async recordFailedLogin(userId: string, current: number): Promise<void> {
    const next = current + 1;
    const lockedUntil =
      next >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: next, lockedUntil },
    });
  }

  private async dummyCompare(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  // The password itself was already committed to the DB — a mail provider
  // hiccup (e.g. sandbox restrictions) must not turn a successful change/reset
  // into a 500 for the caller.
  private async notifyPasswordChanged(email: string): Promise<void> {
    try {
      await this.mail.sendPasswordChangedEmail(email);
    } catch (err) {
      this.logger.error(`Failed to send password-changed email to ${email}`, err);
    }
  }

  private async issueAuth(
    user: User,
    refreshDays = this.config.refreshExpiresDays,
  ): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, refreshDays);
    return {
      auth: {
        user: this.toPublicUser(user),
        accessToken,
      },
      refreshToken,
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.config.jwtAccessSecret,
        expiresIn: 60 * 15,
      },
    );
  }

  private async createRefreshToken(userId: string, days: number): Promise<string> {
    const raw = randomToken(48);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(raw),
        expiresAt,
      },
    });

    return raw;
  }
}
