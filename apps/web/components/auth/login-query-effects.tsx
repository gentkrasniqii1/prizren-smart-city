'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/** Query-driven toasts. Reads the URL after mount so the login form can hydrate. */
export function LoginQueryEffects() {
  const t = useTranslations('Auth');

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const oauthError = search.get('oauth_error');
    if (oauthError) {
      const map: Record<string, string> = {
        cancelled: t('oauthCancelled'),
        state: t('oauthState'),
        account_exists: t('oauthAccountExists'),
        email_required: t('oauthEmailRequired'),
        provider_linked: t('oauthProviderLinked'),
        pending_expired: t('oauthPendingExpired'),
        failed: t('oauthFailed'),
        missing_code: t('oauthFailed'),
      };
      toast.error(map[oauthError] ?? t('oauthFailed'));
    }
    if (search.get('reset') === '1') {
      toast.success(t('resetSuccess'));
    }
  }, [t]);

  return null;
}
