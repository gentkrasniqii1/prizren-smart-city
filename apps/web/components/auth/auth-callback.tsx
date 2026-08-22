'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { consumeLoginNext } from '@/lib/login-next';
import { AuthSessionSkeleton } from '@/components/ui/skeletons';

/** Landing after Google OAuth cookie set — refresh session then go to account. */
export function AuthCallback() {
  const { refreshSession } = useAuth();
  const router = useRouter();
  const t = useTranslations('Auth');

  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get('linked');
    void (async () => {
      const ok = await refreshSession({ force: true });
      if (ok && linked) {
        const provider = linked === 'facebook' ? 'Facebook' : 'Google';
        toast.success(t('oauthLinked', { provider }));
      }
      router.replace(ok ? (consumeLoginNext() ?? '/account') : '/login');
    })();
  }, [refreshSession, router, t]);

  return (
    <main>
      <AuthSessionSkeleton label={t('completingSignIn')} />
    </main>
  );
}
