import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { ConfigService } from '../config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.googleClientId || 'not-configured',
      clientSecret: config.googleClientSecret || 'not-configured',
      callbackURL: config.googleCallbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('Google account has no email'), undefined);
      return;
    }

    try {
      const session = await this.authService.loginWithGoogleProfile({
        googleId: profile.id,
        email,
        name: profile.displayName || email.split('@')[0],
      });
      done(null, session);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
