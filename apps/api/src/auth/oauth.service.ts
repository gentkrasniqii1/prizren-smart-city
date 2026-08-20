import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from './config.service';
import { timingSafeEqualString } from './crypto';

export type OAuthProvider = 'google' | 'facebook';

export type OAuthProfile = {
  provider: OAuthProvider;
  providerId: string;
  email: string | null;
  name: string;
  emailVerified: boolean;
};

@Injectable()
export class OauthService {
  constructor(private readonly config: ConfigService) {}

  providersStatus() {
    return {
      google: this.config.googleAuthEnabled,
      facebook: this.config.facebookAuthEnabled,
    };
  }

  isEnabled(provider: OAuthProvider): boolean {
    if (provider === 'google') return this.config.googleAuthEnabled;
    return this.config.facebookAuthEnabled;
  }

  assertEnabled(provider: OAuthProvider): void {
    if (!this.isEnabled(provider)) {
      throw new ServiceUnavailableException(
        `${provider} authentication is not configured. Set the required environment variables.`,
      );
    }
  }

  buildState(provider: OAuthProvider): { state: string; nonce: string } {
    const nonce = randomBytes(16).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    return { state: `${provider}.${csrf}.${nonce}`, nonce };
  }

  parseState(raw: string | undefined): { provider: OAuthProvider; nonce: string } | null {
    if (!raw) return null;
    const [provider, , nonce] = raw.split('.');
    if (provider !== 'google' && provider !== 'facebook') return null;
    if (!nonce) return null;
    return { provider, nonce };
  }

  authorizationUrl(provider: OAuthProvider, state: string, nonce: string): string {
    this.assertEnabled(provider);
    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: this.config.googleClientId,
        redirect_uri: this.config.googleCallbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        access_type: 'online',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    const params = new URLSearchParams({
      client_id: this.config.facebookAppId,
      redirect_uri: this.config.facebookCallbackUrl,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeGoogle(code: string, nonce: string): Promise<OAuthProfile> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.googleClientId,
      client_secret: this.config.googleClientSecret,
      redirect_uri: this.config.googleCallbackUrl,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      throw new ServiceUnavailableException('Google token exchange failed');
    }
    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!tokens.access_token) {
      throw new ServiceUnavailableException('Google did not return an access token');
    }
    this.assertIdTokenNonce(tokens.id_token, nonce);
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      throw new ServiceUnavailableException('Google profile fetch failed');
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.sub) {
      throw new ServiceUnavailableException('Google profile missing subject');
    }
    return {
      provider: 'google',
      providerId: profile.sub,
      email: profile.email ?? null,
      name: profile.name || profile.email?.split('@')[0] || 'Citizen',
      emailVerified: Boolean(profile.email_verified),
    };
  }

  async exchangeFacebook(code: string): Promise<OAuthProfile> {
    const tokenParams = new URLSearchParams({
      client_id: this.config.facebookAppId,
      client_secret: this.config.facebookAppSecret,
      redirect_uri: this.config.facebookCallbackUrl,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
    );
    if (!tokenRes.ok) {
      throw new ServiceUnavailableException('Facebook token exchange failed');
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new ServiceUnavailableException('Facebook did not return an access token');
    }
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokens.access_token)}`,
    );
    if (!profileRes.ok) {
      throw new ServiceUnavailableException('Facebook profile fetch failed');
    }
    const profile = (await profileRes.json()) as { id?: string; name?: string; email?: string };
    if (!profile.id) {
      throw new ServiceUnavailableException('Facebook profile missing id');
    }
    return {
      provider: 'facebook',
      providerId: profile.id,
      email: profile.email ?? null,
      name: profile.name || profile.email?.split('@')[0] || 'Citizen',
      emailVerified: Boolean(profile.email),
    };
  }

  private assertIdTokenNonce(idToken: string | undefined, nonce: string): void {
    if (!idToken) {
      throw new ServiceUnavailableException('Google did not return an identity token');
    }
    const payload = decodeJwtPayload(idToken);
    const tokenNonce = typeof payload?.nonce === 'string' ? payload.nonce : '';
    if (!tokenNonce || !timingSafeEqualString(tokenNonce, nonce)) {
      throw new ServiceUnavailableException('Google identity token nonce mismatch');
    }
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}
