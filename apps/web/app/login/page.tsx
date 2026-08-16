'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { FieldError, Checkbox } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const search = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const oauth = search.get('oauth_error');
    if (oauth) {
      const map: Record<string, string> = {
        cancelled: t('oauthCancelled'),
        state: t('oauthState'),
        account_exists: t('oauthAccountExists'),
        email_required: t('oauthEmailRequired'),
        failed: t('oauthFailed'),
        missing_code: t('oauthFailed'),
      };
      setFormError(map[oauth] ?? t('oauthFailed'));
    }
    if (search.get('reset') === '1') {
      toast.success(t('resetSuccess'));
    }
  }, [search, t]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = t('emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('emailInvalid');
    if (!password) next.password = t('passwordRequired');
    else if (password.length < 8) next.password = t('passwordMin');
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      const result = await login({
        email: email.trim(),
        password,
        rememberMe,
        website,
      });
      if (result?.requiresTwoFactor) {
        sessionStorage.setItem('psc.2fa', result.challengeToken);
        router.push('/auth/two-factor');
        return;
      }
      router.push('/account');
    } catch (err) {
      if (err instanceof ApiError && err.message === 'EMAIL_NOT_VERIFIED') {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setFormError(err instanceof ApiError ? err.message : t('loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell imageSrc="/images/prizren/sinan-pasha.jpg" imageAlt={t('loginPanelAlt')}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {t('welcomeBack')}
      </p>
      <h1 className="mt-1 text-h1 tracking-tight text-foreground">{t('loginTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('loginSubtitle')}</p>

      <form onSubmit={onSubmit} className="relative mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="login-email">{t('email')}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            invalid={Boolean(fieldErrors.email)}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
          />
          <FieldError message={fieldErrors.email} />
        </div>
        <div>
          <Label htmlFor="login-password">{t('password')}</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
          />
          <FieldError message={fieldErrors.password} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Checkbox id="remember" checked={rememberMe} onChange={setRememberMe}>
            {t('rememberMe')}
          </Checkbox>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {submitting ? t('loggingIn') : t('submitLogin')}
        </Button>
      </form>

      <OAuthButtons disabled={submitting} />

      <p className="mt-6 text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t('registerCta')}
        </Link>
      </p>
      <p className="mt-8 flex gap-4 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          {t('privacy')}
        </Link>
        <Link href="/terms" className="hover:underline">
          {t('terms')}
        </Link>
      </p>
    </AuthShell>
  );
}
