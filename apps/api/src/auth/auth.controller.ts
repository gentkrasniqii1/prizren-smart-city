import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import type { AuthResponse } from '@prizren/shared-types';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleEnabledGuard } from './guards/google-enabled.guard';
import { rejectIfHoneypotFilled } from '../common/honeypot';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    rejectIfHoneypotFilled(dto.website);
    const { auth, refreshToken } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return auth;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    rejectIfHoneypotFilled(dto.website);
    const { auth, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return auth;
  }

  @Get('google/status')
  googleStatus() {
    return { enabled: this.config.googleAuthEnabled };
  }

  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  googleCallback(
    @Req() req: Request & { user: { auth: AuthResponse; refreshToken: string } },
    @Res() res: Response,
  ) {
    const session = req.user;
    this.setRefreshCookie(res, session.refreshToken);
    return res.redirect(`${this.config.webOrigin}/auth/callback`);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.config.refreshCookieName] as string | undefined;
    const { accessToken, refreshToken } = await this.authService.refresh(raw);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.config.refreshCookieName] as string | undefined;
    await this.authService.logout(raw);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  private setRefreshCookie(res: Response, token: string) {
    const maxAgeMs = this.config.refreshExpiresDays * 24 * 60 * 60 * 1000;
    res.cookie(this.config.refreshCookieName, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/auth',
      maxAge: maxAgeMs,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(this.config.refreshCookieName, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/auth',
    });
  }
}
