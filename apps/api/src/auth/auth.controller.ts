import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  totpCodeRequestSchema,
  twoFactorVerifyRequestSchema,
  verifyEmailRequestSchema,
} from '@prizren/shared-types';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { OauthService, type OAuthProvider } from './oauth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorLoginDto } from './dto/two-factor.dto';
import { TotpCodeDto } from './dto/totp-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from './decorators/current-user.decorator';
import { rejectIfHoneypotFilled } from '../common/honeypot';
import { getClientIp } from '../common/client-ip';
import { zodBody } from '../common/zod-validation.pipe';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';
import { timingSafeEqualString } from './crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly oauth: OauthService,
  ) {}

  @Get('providers')
  providers() {
    return this.oauth.providersStatus();
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body(zodBody(registerRequestSchema)) dto: RegisterDto) {
    rejectIfHoneypotFilled(dto.website);
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(zodBody(loginRequestSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    rejectIfHoneypotFilled(dto.website);
    const trustedDeviceRaw = req.cookies?.[this.config.trustedDeviceCookieName] as
      string | undefined;
    const result = await this.authService.login(dto, trustedDeviceRaw, {
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
    if (result.kind === '2fa') {
      return { requiresTwoFactor: true, challengeToken: result.challengeToken };
    }
    // "Remember me" unchecked => session cookie (cleared when the browser closes).
    this.setRefreshCookie(res, result.refreshToken, result.refreshDays, Boolean(dto.rememberMe));
    return result.auth;
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyTwoFactor(
    @Body(zodBody(twoFactorVerifyRequestSchema)) dto: TwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyTwoFactorLogin(
      dto.challengeToken,
      dto.code,
      dto.trustDevice,
      {
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      },
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshDays);
    if (result.trustedDeviceToken) {
      this.setTrustedDeviceCookie(res, result.trustedDeviceToken);
    }
    return result.auth;
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  startTotp(@CurrentUser() user: AuthUser) {
    return this.authService.startTotpSetup(user.id);
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  confirmTotp(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(totpCodeRequestSchema)) dto: TotpCodeDto,
  ) {
    return this.authService.confirmTotpSetup(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disableTotp(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(totpCodeRequestSchema)) dto: TotpCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.disableTotp(user.id, dto.code);
    // Trust no longer means anything once 2FA is off — the same cookie could
    // otherwise be replayed to skip 2FA if it's re-enabled later.
    this.clearTrustedDeviceCookie(res);
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body(zodBody(forgotPasswordRequestSchema)) dto: ForgotPasswordDto) {
    rejectIfHoneypotFilled(dto.website);
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body(zodBody(resetPasswordRequestSchema)) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(changePasswordRequestSchema)) dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    // All refresh tokens were just revoked server-side — drop the cookie too so the
    // browser doesn't keep trying (now-invalid) silent refreshes with it.
    this.clearRefreshCookie(res);
    this.clearTrustedDeviceCookie(res);
    return result;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(
    @Body(zodBody(verifyEmailRequestSchema)) dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto.token);
    this.setRefreshCookie(res, result.refreshToken, result.refreshDays);
    return result.auth;
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendVerification(
    @Body(zodBody(resendVerificationRequestSchema)) dto: ResendVerificationDto,
  ) {
    rejectIfHoneypotFilled(dto.website);
    return this.authService.requestEmailVerification(dto.email);
  }

  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  startGoogle(@Res() res: Response) {
    return this.startOauth(res, 'google');
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOauth(res, req, 'google', { code, state, error });
  }

  @Get('apple')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  startApple(@Res() res: Response) {
    return this.startOauth(res, 'apple');
  }

  @Post('apple/callback')
  async appleCallbackPost(
    @Body()
    body: { code?: string; state?: string; error?: string; user?: string; id_token?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOauth(res, req, 'apple', {
      code: body.code,
      state: body.state,
      error: body.error,
      user: body.user,
    });
  }

  @Get('apple/callback')
  async appleCallbackGet(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOauth(res, req, 'apple', { code, state, error });
  }

  @Get('facebook')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  startFacebook(@Res() res: Response) {
    return this.startOauth(res, 'facebook');
  }

  @Get('facebook/callback')
  async facebookCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.finishOauth(res, req, 'facebook', { code, state, error });
  }

  @Get('google/status')
  googleStatus() {
    return { enabled: this.config.googleAuthEnabled };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfOriginGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.config.refreshCookieName] as string | undefined;
    const { accessToken, refreshToken, refreshDays, persistent } =
      await this.authService.refresh(raw);
    // Preserve the original "remember me" choice across token rotation.
    this.setRefreshCookie(res, refreshToken, refreshDays, persistent);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, CsrfOriginGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.config.refreshCookieName] as string | undefined;
    await this.authService.logout(raw);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, CsrfOriginGuard)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAll(user.id);
    this.clearRefreshCookie(res);
    this.clearTrustedDeviceCookie(res);
    return { ok: true };
  }

  private startOauth(res: Response, provider: OAuthProvider) {
    this.oauth.assertEnabled(provider);
    const { state, nonce } = this.oauth.buildState(provider);
    res.cookie(this.config.oauthStateCookieName, state, this.oauthCookieOptions());
    return res.redirect(this.oauth.authorizationUrl(provider, state, nonce));
  }

  private async finishOauth(
    res: Response,
    req: Request,
    provider: OAuthProvider,
    payload: { code?: string; state?: string; error?: string; user?: string },
  ) {
    const loginUrl = `${this.config.webOrigin}/login`;
    if (payload.error) {
      return res.redirect(`${loginUrl}?oauth_error=cancelled`);
    }
    const cookieState = req.cookies?.[this.config.oauthStateCookieName] as string | undefined;
    res.clearCookie(this.config.oauthStateCookieName, { path: '/' });
    if (!payload.state || !cookieState || !timingSafeEqualString(payload.state, cookieState)) {
      return res.redirect(`${loginUrl}?oauth_error=state`);
    }
    const parsed = this.oauth.parseState(payload.state);
    if (!parsed || parsed.provider !== provider) {
      return res.redirect(`${loginUrl}?oauth_error=state`);
    }
    if (!payload.code) {
      return res.redirect(`${loginUrl}?oauth_error=missing_code`);
    }

    try {
      const profile =
        provider === 'google'
          ? await this.oauth.exchangeGoogle(payload.code, parsed.nonce)
          : provider === 'apple'
            ? await this.oauth.exchangeApple(payload.code, parsed.nonce, payload.user)
            : await this.oauth.exchangeFacebook(payload.code);

      const session = await this.authService.loginWithOAuth(profile, {
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      });
      this.setRefreshCookie(res, session.refreshToken, session.refreshDays);
      const callbackUrl = new URL(`${this.config.webOrigin}/auth/callback`);
      if (session.linkedAccount) {
        callbackUrl.searchParams.set('linked', provider);
      }
      return res.redirect(callbackUrl.toString());
    } catch (err) {
      const code = this.oauthErrorCode(err);
      return res.redirect(`${loginUrl}?oauth_error=${code}`);
    }
  }

  private oauthErrorCode(err: unknown): string {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : '';
    if (message.includes('ACCOUNT_EXISTS_PASSWORD')) return 'account_exists';
    if (message.includes('EMAIL_REQUIRED')) return 'email_required';
    return 'failed';
  }

  private oauthCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
    };
  }

  /**
   * `persistent = false` sets a session cookie (no Max-Age/Expires) so the browser
   * drops it on close — used when "remember me" is unchecked. Defaults to persistent
   * for flows without a remember-me choice (email verification, OAuth, 2FA).
   */
  private setRefreshCookie(res: Response, token: string, days: number, persistent = true) {
    const options: CookieOptions = {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/auth',
    };
    if (persistent) {
      options.maxAge = days * 24 * 60 * 60 * 1000;
    }
    res.cookie(this.config.refreshCookieName, token, options);
  }

  private setTrustedDeviceCookie(res: Response, token: string) {
    res.cookie(this.config.trustedDeviceCookieName, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/auth',
      maxAge: this.config.trustedDeviceDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearTrustedDeviceCookie(res: Response) {
    res.clearCookie(this.config.trustedDeviceCookieName, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/auth',
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
