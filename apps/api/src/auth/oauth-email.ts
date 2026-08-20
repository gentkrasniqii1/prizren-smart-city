/** Reserved RFC 2606 TLD — never a deliverable mailbox. */
export const OAUTH_PLACEHOLDER_DOMAIN = 'oauth.invalid';

export function facebookPlaceholderEmail(facebookId: string): string {
  const id = facebookId.replace(/[^a-zA-Z0-9._-]/g, '') || 'unknown';
  return `fb.${id}@${OAUTH_PLACEHOLDER_DOMAIN}`;
}

export function isOauthPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.toLowerCase().endsWith(`@${OAUTH_PLACEHOLDER_DOMAIN}`);
}
