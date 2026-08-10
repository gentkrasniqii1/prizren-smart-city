import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { AuthResponse, PublicUser } from '@prizren/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from './config.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash,
        role: Role.CITIZEN,
      },
    });

    return this.issueAuth(user);
  }

  async login(dto: LoginDto): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueAuth(user);
  }

  /** Find-or-create citizen from Google profile, then issue the same JWT session as password login. */
  async loginWithGoogleProfile(profile: {
    googleId: string;
    email: string;
    name: string;
  }): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const email = profile.email.toLowerCase().trim();
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.googleId }, { email }],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.name.trim() || email.split('@')[0],
          googleId: profile.googleId,
          role: Role.CITIZEN,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId },
      });
    }

    return this.issueAuth(user);
  }

  async refresh(
    rawToken: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate refresh token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.signAccessToken(stored.user);
    const refreshToken = await this.createRefreshToken(stored.user.id);
    return { accessToken, refreshToken };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }

    const tokenHash = this.hashToken(rawToken);
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
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async issueAuth(user: User): Promise<{ auth: AuthResponse; refreshToken: string }> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);
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

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.refreshExpiresDays);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return raw;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
