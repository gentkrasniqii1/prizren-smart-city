'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { InstitutionAccessResolveDto } from '@prizren/shared-types';
import { apiFetch, ApiError } from '@/lib/api';
import { rememberLoginNext } from '@/lib/login-next';
import { useAuth } from '@/components/auth-provider';
import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/ui';
import { ReportDetailSkeleton } from '@/components/ui/skeletons';

function isStaff(role?: string) {
  return role === 'DEPARTMENT_STAFF' || role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN';
}

export function InstitutionReportGate() {
  const params = useParams<{ token: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('InstitutionAccess');
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<'invalid' | 'forbidden' | 'generic' | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const token = params.token;
    if (!token) {
      setError('invalid');
      return;
    }
    if (!user) {
      rememberLoginNext(pathname);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!isStaff(user.role)) {
      setError('forbidden');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<InstitutionAccessResolveDto>(
          `/institution-access/${encodeURIComponent(token)}`,
          { auth: true },
        );
        if (cancelled) return;
        router.replace(`/reports/${res.reportId}`);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          rememberLoginNext(pathname);
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setError('forbidden');
          return;
        }
        setError(err instanceof ApiError && err.status === 404 ? 'invalid' : 'generic');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, params.token, pathname, router]);

  if (error) {
    return (
      <main className="bg-muted/30 pb-bottom-nav pt-6 sm:pt-8">
        <PageContainer>
          <ErrorState
            title={error === 'forbidden' ? t('forbiddenTitle') : t('invalidTitle')}
            description={
              error === 'forbidden'
                ? t('forbiddenBody')
                : error === 'invalid'
                  ? t('invalidBody')
                  : t('genericBody')
            }
          />
        </PageContainer>
      </main>
    );
  }

  return (
    <main>
      <ReportDetailSkeleton />
    </main>
  );
}
