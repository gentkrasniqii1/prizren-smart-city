'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { Spinner } from '@/components/ui';

/** Landing after Google OAuth cookie set — refresh session then go to account. */
export default function AuthCallbackPage() {
  const { refreshSession } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations('Auth');

  useEffect(() => {
    void (async () => {
      const ok = await refreshSession({ force: true });
      if (ok && search.get('linked')) {
        toast.success(t('oauthLinked'));
      }
      router.replace(ok ? '/account' : '/login');
    })();
  }, [refreshSession, router, search, t]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4">
      <Spinner label="Duke përfunduar hyrjen…" />
    </main>
  );
}
