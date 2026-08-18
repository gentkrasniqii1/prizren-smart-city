import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createPrivateKey, randomBytes, sign } from 'crypto';
import { verifyIdToken } from 'apple-signin-auth';
import { ConfigService } from './config.service';
import { timingSafeEqualString } from './crypto';

export type OAuthProvider = 'google' | 'apple' | 'facebook';

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
      apple: this.config.appleAuthEnabled,
      facebook: this.config.facebookAuthEnabled,
    };
  }

  isEnabled(provider: OAuthProvider): boolean {
    if (provider === 'google') return this.config.googleAuthEnabled;
    if (provider === 'apple') return this.config.appleAuthEnabled;
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
    if (provider !== 'google' && provider !== 'apple' && provider !== 'facebook') return null;
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
    if (provider === 'apple') {
      const params = new URLSearchParams({
        client_id: this.config.appleClientId,
        redirect_uri: this.config.appleCallbackUrl,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope: 'name email',
        state,
        nonce: createHash('sha256').update(nonce).digest('hex'),
      });
      return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
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

  async exchangeApple(code: string, nonce: string, userJson?: string): Promise<OAuthProfile> {
    const clientSecret = this.createAppleClientSecret();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.appleCallbackUrl,
      client_id: this.config.appleClientId,
      client_secret: clientSecret,
    });
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      throw new ServiceUnavailableException('Apple token exchange failed');
    }
    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new ServiceUnavailableException('Apple did not return an identity token');
    }
    const payload = await verifyIdToken(tokens.id_token, {
      audience: this.config.appleClientId,
      nonce: createHash('sha256').update(nonce).digest('hex'),
    });

    let name = payload.email?.split('@')[0] || 'Citizen';
    if (userJson) {
      try {
        const parsed = JSON.parse(userJson) as {
          name?: { firstName?: string; lastName?: string };
        };
        const full = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ');
        if (full) name = full;
      } catch {
        // Apple user payload is only present on first authorization
      }
    }

    return {
      provider: 'apple',
      providerId: payload.sub,
      email: payload.email ?? null,
      name,
      emailVerified: Boolean(payload.email_verified),
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

  private createAppleClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: this.config.appleKeyId }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: this.config.appleTeamId,
        iat: now,
        exp: now + 86400 * 150,
        aud: 'https://appleid.apple.com',
        sub: this.config.appleClientId,
      }),
    ).toString('base64url');
    const key = createPrivateKey(this.config.applePrivateKey);
    const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
      key,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');
    return `${header}.${payload}.${signature}`;
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
