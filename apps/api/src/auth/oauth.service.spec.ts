import { describe, expect, it, vi } from 'vitest';
import { OauthService } from './oauth.service';
import { ConfigService } from './config.service';

function makeConfig(): ConfigService {
  return {
    googleClientId: 'google-client',
    googleCallbackUrl: 'http://localhost:3001/auth/google/callback',
    googleAuthEnabled: true,
    facebookAppId: 'fb-app',
    facebookCallbackUrl: 'http://localhost:3001/auth/facebook/callback',
    facebookAuthEnabled: true,
  } as unknown as ConfigService;
}

describe('OauthService', () => {
  const oauth = new OauthService(makeConfig());

  it('builds a state token that round-trips provider and nonce', () => {
    const { state, nonce } = oauth.buildState('google');
    const parsed = oauth.parseState(state);
    expect(parsed).toEqual({ provider: 'google', nonce });
    expect(state.split('.')).toHaveLength(3);
  });

  it('rejects a malformed or foreign state', () => {
    expect(oauth.parseState('not-a-state')).toBeNull();
    expect(oauth.parseState('twitter.csrf.nonce')).toBeNull();
    expect(oauth.parseState('apple.csrf.nonce')).toBeNull();
    expect(oauth.parseState(undefined)).toBeNull();
  });

  it('includes nonce in the Google authorization URL', () => {
    const url = oauth.authorizationUrl('google', 'google.csrf.nonce', 'nonce-value');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('nonce')).toBe('nonce-value');
    expect(parsed.searchParams.get('state')).toBe('google.csrf.nonce');
    expect(parsed.searchParams.get('scope')).toContain('openid');
  });

  it('does not advertise Apple as an available provider', () => {
    expect(oauth.providersStatus()).toEqual({ google: true, facebook: true });
    expect(oauth.providersStatus()).not.toHaveProperty('apple');
  });

  it('rejects a Google token response whose id_token nonce does not match', async () => {
    const idToken = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({ nonce: 'other-nonce' })).toString('base64url'),
      'sig',
    ].join('.');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'tok', id_token: idToken }),
      }),
    );
    await expect(oauth.exchangeGoogle('code', 'expected-nonce')).rejects.toThrow(/nonce/);
    vi.unstubAllGlobals();
  });
});
