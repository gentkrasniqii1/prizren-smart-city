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
import { isOauthPlaceholderEmail } from './oauth-email';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const VERIFY_HOURS = 24;
const RESET_HOURS = 1;
const TWO_FACTOR_MINUTES = 10;
/** Precomputed bcrypt hash used to keep unknown-user login timing close to a real compare. */
const DUMMY_PASSWORD_HASH = '$2b$12$2ob0Xf6XiYZ7X5Ft3MtIs.LRNF8mjSSVBX2Eq4.8RoGiVnpo9sGRe';

export type LoginContext = {
  ip?: string | null;
  userAgent?: string | null;
};

const STAFF_ROLES: Role[] = [Role.DEPARTMENT_STAFF, Role.DEPARTMENT_ADMIN, Role.SUPER_ADMIN];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
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
    trustedDeviceRaw?: string,
    ctx: LoginContext = {},
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
      await this.recordFailedLogin(user, ctx);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('EMAIL_NOT_VERIFIED');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    if (user.totpEnabled && !(await this.isTrustedDevice(user.id, trustedDeviceRaw))) {
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
    await this.recordSuccessfulLogin(user, ctx);
    return { kind: 'auth', ...issued, refreshDays };
  }

  async verifyTwoFactorLogin(
    challengeToken: string,
    code: string,
    trustDevice = false,
    ctx: LoginContext = {},
  ): Promise<{
    auth: AuthResponse;
    refreshToken: string;
    refreshDays: number;
    trustedDeviceToken?: string;
  }> {
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
    const trustedDeviceToken = trustDevice ? await this.createTrustedDevice(user.id) : undefined;
    await this.recordSuccessfulLogin(user, ctx);
    return { ...issued, refreshDays, trustedDeviceToken };
  }

  async peekRefreshUser(rawToken: string | undefined): Promise<{ id: string } | null> {
    if (!rawToken) {
      return null;
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return { id: stored.userId };
  }

  async loginWithOAuth(
    profile: OAuthProfile,
    ctx: LoginContext = {},
    linkUserId?: string,
  ): Promise<
    | {
        kind: 'auth';
        auth: AuthResponse;
        refreshToken: string;
        refreshDays: number;
        linkedAccount: boolean;
      }
    | { kind: 'needs_email'; pendingToken: string }
  > {
    if (linkUserId) {
      return { kind: 'auth', ...(await this.linkOAuthToSessionUser(linkUserId, profile, ctx)) };
    }

    const providerIdField = this.providerIdField(profile.provider);
    let user = await this.prisma.user.findFirst({
      where: { [providerIdField]: profile.providerId },
    });

    if (user && isOauthPlaceholderEmail(user.email)) {
      return { kind: 'needs_email', pendingToken: await this.createOauthPending(profile) };
    }

    let linkedAccount = false;

    if (!user && profile.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase().trim() },
      });
      if (byEmail) {
        const existingProviderId = byEmail[providerIdField];
        if (existingProviderId && existingProviderId !== profile.providerId) {
          throw new ConflictException('ACCOUNT_EXISTS_PASSWORD');
        }

        const hasPassword = Boolean(byEmail.passwordHash);
        // Google verifies the mailbox itself. Facebook only shares an address when
        // the person granted email permission — treat that as enough to auto-link.
        const canAutoLink =
          hasPassword &&
          !existingProviderId &&
          (profile.provider === 'google' ? profile.emailVerified : Boolean(profile.email));

        if (hasPassword && !existingProviderId && !canAutoLink) {
          throw new ConflictException('ACCOUNT_EXISTS_PASSWORD');
        }

        linkedAccount = canAutoLink;
        await this.releaseProviderIdIfEmptyPlaceholder(providerIdField, profile.providerId);

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
        if (profile.provider !== 'facebook') {
          throw new BadRequestException('EMAIL_REQUIRED');
        }
        return { kind: 'needs_email', pendingToken: await this.createOauthPending(profile) };
      }
      await this.releaseProviderIdIfEmptyPlaceholder(providerIdField, profile.providerId);
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
    } else {
      user = await this.maybeAttachFacebookEmail(user, profile);
      if (
        !user.emailVerified &&
        profile.email &&
        !isOauthPlaceholderEmail(user.email) &&
        user.email.toLowerCase() === profile.email.toLowerCase()
      ) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, emailVerifiedAt: new Date() },
        });
      }
    }

    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    await this.recordSuccessfulLogin(user, ctx);
    return { kind: 'auth', ...issued, refreshDays, linkedAccount };
  }

  async completeFacebookEmail(
    rawPending: string | undefined,
    email: string,
  ): Promise<{ ok: true; email: string; devVerifyToken?: string }> {
    const pending = await this.requireOauthPending(rawPending);
    if (pending.provider !== 'facebook') {
      throw new BadRequestException('FACEBOOK_PENDING_EXPIRED');
    }
    const normalized = email.toLowerCase().trim();
    if (isOauthPlaceholderEmail(normalized)) {
      throw new BadRequestException('Invalid email');
    }

    const nextRaw = randomToken(48);
    await this.prisma.oauthPending.update({
      where: { id: pending.id },
      data: {
        email: normalized,
        tokenHash: sha256Hex(nextRaw),
        expiresAt: new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${this.config.webOrigin}/auth/complete-facebook?token=${encodeURIComponent(nextRaw)}`;
    await this.safeSendMail('verification', () =>
      this.mail.sendVerificationEmail(normalized, verifyUrl),
    );

    return {
      ok: true,
      email: normalized,
      ...(!this.mail.configured && !this.config.isProduction ? { devVerifyToken: nextRaw } : {}),
    };
  }

  async verifyFacebookPending(
    rawToken: string,
    ctx: LoginContext = {},
  ): Promise<{
    auth: AuthResponse;
    refreshToken: string;
    refreshDays: number;
    linkedAccount: boolean;
  }> {
    const pending = await this.requireOauthPending(rawToken);
    if (pending.provider !== 'facebook' || !pending.email) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const result = await this.fulfillFacebookPending(
      {
        providerId: pending.providerId,
        name: pending.name,
        email: pending.email,
      },
      ctx,
    );
    await this.prisma.oauthPending.delete({ where: { id: pending.id } });
    return result;
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
      await this.safeSendMail('password-reset', () =>
        this.mail.sendPasswordResetEmail(user.email, resetUrl),
      );
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
      this.prisma.trustedDevice.deleteMany({ where: { userId: user.id } }),
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
        'This account signs in with a provider (Google/Facebook) and has no password. Use "Forgot password" to set one.',
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
      this.prisma.trustedDevice.deleteMany({ where: { userId: user.id } }),
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
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpEnabled: false, totpSecretEnc: null },
      }),
      this.prisma.trustedDevice.deleteMany({ where: { userId } }),
    ]);
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

  /** Revokes every active refresh token and trusted-device grant for the user. */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.trustedDevice.deleteMany({ where: { userId } }),
    ]);
  }

  toPublicUser(user: User): PublicUser {
    const needsEmail = isOauthPlaceholderEmail(user.email);
    return {
      id: user.id,
      email: needsEmail ? '' : user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      emailVerified: needsEmail ? false : user.emailVerified,
      totpEnabled: user.totpEnabled,
      hasPassword: Boolean(user.passwordHash),
      googleLinked: Boolean(user.googleId),
      facebookLinked: Boolean(user.facebookId),
      needsEmail,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async setAccountEmail(userId: string, email: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!isOauthPlaceholderEmail(user.email)) {
      throw new BadRequestException('Email is already set on this account');
    }
    const normalized = email.toLowerCase().trim();
    const taken = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (taken) {
      throw new ConflictException('Email is already registered');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: normalized,
        emailVerified: false,
        emailVerifiedAt: null,
      },
    });
    await this.issueEmailVerification(updated);
    return this.toPublicUser(updated);
  }

  private async linkOAuthToSessionUser(
    userId: string,
    profile: OAuthProfile,
    ctx: LoginContext,
  ): Promise<{
    auth: AuthResponse;
    refreshToken: string;
    refreshDays: number;
    linkedAccount: boolean;
  }> {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) {
      throw new UnauthorizedException();
    }
    const providerIdField = this.providerIdField(profile.provider);
    const existingId = current[providerIdField];
    if (existingId && existingId !== profile.providerId) {
      throw new ConflictException('PROVIDER_ALREADY_LINKED');
    }

    await this.releaseProviderIdIfEmptyPlaceholder(providerIdField, profile.providerId, current.id);

    const holder = await this.prisma.user.findFirst({
      where: { [providerIdField]: profile.providerId },
    });
    if (holder && holder.id !== current.id) {
      throw new ConflictException('PROVIDER_ALREADY_LINKED');
    }

    const linkedAccount = !existingId;
    const user = existingId
      ? current
      : await this.prisma.user.update({
          where: { id: current.id },
          data: { [providerIdField]: profile.providerId },
        });

    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    await this.recordSuccessfulLogin(user, ctx);
    return { ...issued, refreshDays, linkedAccount };
  }

  private async fulfillFacebookPending(
    pending: { providerId: string; name: string; email: string },
    ctx: LoginContext,
  ): Promise<{
    auth: AuthResponse;
    refreshToken: string;
    refreshDays: number;
    linkedAccount: boolean;
  }> {
    const email = pending.email.toLowerCase().trim();
    await this.releaseProviderIdIfEmptyPlaceholder('facebookId', pending.providerId);

    const byFacebook = await this.prisma.user.findFirst({
      where: { facebookId: pending.providerId },
    });
    const byEmail = await this.prisma.user.findUnique({ where: { email } });

    if (byFacebook && byEmail && byFacebook.id !== byEmail.id) {
      throw new ConflictException('PROVIDER_ALREADY_LINKED');
    }
    if (byFacebook && !byEmail) {
      throw new ConflictException('PROVIDER_ALREADY_LINKED');
    }

    let user = byEmail;
    let linkedAccount = false;
    if (user) {
      if (user.facebookId && user.facebookId !== pending.providerId) {
        throw new ConflictException('PROVIDER_ALREADY_LINKED');
      }
      linkedAccount = !user.facebookId;
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          facebookId: pending.providerId,
          emailVerified: true,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          name: pending.name.trim() || email.split('@')[0],
          facebookId: pending.providerId,
          role: Role.CITIZEN,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    const refreshDays = this.config.refreshExpiresDays;
    const issued = await this.issueAuth(user, refreshDays);
    await this.recordSuccessfulLogin(user, ctx);
    return { ...issued, refreshDays, linkedAccount };
  }

  private async createOauthPending(profile: OAuthProfile): Promise<string> {
    await this.prisma.oauthPending.deleteMany({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    const raw = randomToken(48);
    const expiresAt = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000);
    await this.prisma.oauthPending.create({
      data: {
        tokenHash: sha256Hex(raw),
        provider: profile.provider,
        providerId: profile.providerId,
        name: profile.name.trim() || 'Citizen',
        expiresAt,
      },
    });
    return raw;
  }

  private async requireOauthPending(rawToken: string | undefined) {
    if (!rawToken) {
      throw new BadRequestException('FACEBOOK_PENDING_EXPIRED');
    }
    const pending = await this.prisma.oauthPending.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });
    if (!pending || pending.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return pending;
  }

  /** Drop a leftover Facebook stub so the real account can take the provider id. */
  private async releaseProviderIdIfEmptyPlaceholder(
    field: 'googleId' | 'facebookId',
    providerId: string,
    exceptUserId?: string,
  ): Promise<void> {
    const holder = await this.prisma.user.findFirst({
      where: { [field]: providerId },
    });
    if (!holder || holder.id === exceptUserId) {
      return;
    }
    if (!(await this.isEmptyOauthPlaceholder(holder))) {
      return;
    }
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId: holder.id } }),
      this.prisma.auditLog.deleteMany({ where: { userId: holder.id } }),
      this.prisma.user.delete({ where: { id: holder.id } }),
    ]);
  }

  private async isEmptyOauthPlaceholder(user: User): Promise<boolean> {
    if (!isOauthPlaceholderEmail(user.email)) {
      return false;
    }
    if (user.passwordHash || user.googleId) {
      return false;
    }
    const [reports, comments, votes] = await Promise.all([
      this.prisma.report.count({ where: { userId: user.id } }),
      this.prisma.comment.count({ where: { userId: user.id } }),
      this.prisma.vote.count({ where: { userId: user.id } }),
    ]);
    return reports + comments + votes === 0;
  }

  private providerIdField(provider: OAuthProvider): 'googleId' | 'facebookId' {
    return provider === 'google' ? 'googleId' : 'facebookId';
  }

  private async maybeAttachFacebookEmail(user: User, profile: OAuthProfile): Promise<User> {
    if (profile.provider !== 'facebook' || !profile.email || !isOauthPlaceholderEmail(user.email)) {
      return user;
    }
    const normalized = profile.email.toLowerCase().trim();
    const taken = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (taken) {
      return user;
    }
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: normalized,
        emailVerified: Boolean(profile.emailVerified),
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
      },
    });
  }

  private async issueEmailVerification(user: User): Promise<string> {
    if (isOauthPlaceholderEmail(user.email)) {
      return '';
    }
    await this.prisma.authToken.updateMany({
      where: { userId: user.id, type: AuthTokenType.EMAIL_VERIFY, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = await this.createAuthToken(user.id, AuthTokenType.EMAIL_VERIFY, {
      hours: VERIFY_HOURS,
    });
    const verifyUrl = `${this.config.webOrigin}/verify-email?token=${encodeURIComponent(raw)}`;
    await this.safeSendMail('verification', () =>
      this.mail.sendVerificationEmail(user.email, verifyUrl),
    );
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

  /** Creates a "trust this device" token (raw value returned once, only its hash is stored). */
  private async createTrustedDevice(userId: string): Promise<string> {
    const raw = randomToken(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.trustedDeviceDays);
    await this.prisma.trustedDevice.create({
      data: { userId, tokenHash: sha256Hex(raw), expiresAt },
    });
    return raw;
  }

  /** Lets a recognized device skip the TOTP challenge until the trust expires. */
  private async isTrustedDevice(userId: string, rawToken: string | undefined): Promise<boolean> {
    if (!rawToken) return false;
    const stored = await this.prisma.trustedDevice.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });
    if (!stored || stored.userId !== userId || stored.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    await this.prisma.trustedDevice.update({
      where: { id: stored.id },
      data: { lastUsedAt: new Date() },
    });
    return true;
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

  private async recordFailedLogin(user: User, ctx: LoginContext): Promise<void> {
    const next = user.failedLoginCount + 1;
    const locked =
      next >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: next, lockedUntil: locked },
    });
    await this.audit.log({
      userId: user.id,
      actorType: 'USER',
      action: locked ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { failedLoginCount: next },
    });
    if (locked) {
      await this.safeSendMail('account-locked', () => this.mail.sendAccountLockedEmail(user.email));
    }
  }

  private async recordSuccessfulLogin(user: User, ctx: LoginContext): Promise<void> {
    const previousIp = user.lastLoginIp;
    const ip = ctx.ip ?? null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });
    await this.audit.log({
      userId: user.id,
      actorType: 'USER',
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ctx.userAgent,
      metadata: previousIp ? { previousIp } : undefined,
    });
    if (previousIp && ip && previousIp !== ip) {
      // Same PASSWORD_RESET token path as forgotPassword (1h, single-use).
      await this.prisma.authToken.updateMany({
        where: { userId: user.id, type: AuthTokenType.PASSWORD_RESET, usedAt: null },
        data: { usedAt: new Date() },
      });
      const raw = await this.createAuthToken(user.id, AuthTokenType.PASSWORD_RESET, {
        hours: RESET_HOURS,
      });
      const resetUrl = `${this.config.webOrigin}/reset-password?token=${encodeURIComponent(raw)}`;
      await this.safeSendMail('suspicious-login', () =>
        this.mail.sendSuspiciousLoginEmail(user.email, {
          ip,
          userAgent: ctx.userAgent ?? null,
          resetUrl,
        }),
      );
    }
  }

  private async dummyCompare(): Promise<void> {
    await bcrypt.compare('not-a-real-password', DUMMY_PASSWORD_HASH);
  }

  // The underlying DB write (password change, token issuance, etc.) was already
  // committed — a mail provider hiccup (e.g. Resend sandbox restrictions, a
  // network blip) must never turn an otherwise-successful request into a 500.
  private async safeSendMail(context: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (err) {
      this.logger.error(`Failed to send ${context} email`, err);
    }
  }

  private async notifyPasswordChanged(email: string): Promise<void> {
    await this.safeSendMail('password-changed', () => this.mail.sendPasswordChangedEmail(email));
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
        expiresIn: this.config.jwtAccessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
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
