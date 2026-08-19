'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Logo } from '@/components/brand/Logo';
import { FieldError, Checkbox, FormError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { login } = useAuth();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');
  const [oauthBusy, setOauthBusy] = useState(false);

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
    if (submitStatus === 'loading' || submitStatus === 'success' || oauthBusy) return;
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitStatus('loading');
    try {
      const result = await login({
        email: email.trim(),
        password,
        rememberMe,
        website,
      });
      setSubmitStatus('success');
      if (result?.requiresTwoFactor) {
        sessionStorage.setItem('psc.2fa', result.challengeToken);
        router.push('/auth/two-factor');
        return;
      }
      router.push('/account');
    } catch (err) {
      if (err instanceof ApiError && err.message === 'EMAIL_NOT_VERIFIED') {
        setSubmitStatus('success');
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setFormError(errorMessage(err, t('loginFailed')));
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell
      imageSrc="/images/prizren/overview.jpg"
      imageAlt={t('loginHeroAlt')}
      headline={t('panelHeadline')}
      body={t('panelBody')}
    >
      <Link href="/" className="hidden text-foreground lg:inline-flex">
        <Logo variant="icon" size={36} />
      </Link>

      <p className="ds-kicker lg:mt-8">{t('welcomeBack')}</p>
      <h1 className="ds-page-title mt-2">{t('loginTitle')}</h1>

      <form onSubmit={onSubmit} className="relative mt-6 space-y-4 lg:mt-8" noValidate>
        <div>
          <Label htmlFor="login-email">{t('email')}</Label>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="next"
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
            enterKeyHint="go"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
          />
          <FieldError message={fieldErrors.password} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox id="remember" checked={rememberMe} onChange={setRememberMe}>
            {t('rememberMe')}
          </Checkbox>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
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

        <FormError message={formError} />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          status={submitStatus}
          disabled={oauthBusy}
        >
          {submitStatus === 'loading' ? t('loggingIn') : t('submitLogin')}
        </Button>
      </form>

      <OAuthButtons
        disabled={submitStatus === 'loading' || submitStatus === 'success'}
        onBusyChange={setOauthBusy}
      />

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
