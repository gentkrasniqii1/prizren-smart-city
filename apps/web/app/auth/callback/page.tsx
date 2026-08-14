'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Spinner } from '@/components/ui';

/** Landing after Google OAuth cookie set — refresh session then go to account. */
export default function AuthCallbackPage() {
  const { refreshSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const ok = await refreshSession({ force: true });
      router.replace(ok ? '/account' : '/login');
    })();
  }, [refreshSession, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4">
      <Spinner label="Duke përfunduar hyrjen…" />
    </main>
  );
}
