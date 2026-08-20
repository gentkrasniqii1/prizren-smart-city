'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { loginRequestSchema } from '@prizren/shared-types';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Logo } from '@/components/brand/Logo';
import { FieldError, Checkbox, FormError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useErrorMessage } from '@/lib/use-error-message';

export function LoginForm() {
  const t = useTranslations('Auth');
  const tNav = useTranslations('Nav');
  const router = useRouter();
  const { login } = useAuth();
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');
  const [oauthBusy, setOauthBusy] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '', rememberMe: false, website: '' },
  });

  const rememberMe = watch('rememberMe') ?? false;

  async function onValid(values: {
    email: string;
    password: string;
    rememberMe?: boolean;
    website?: string;
  }) {
    if (submitStatus === 'loading' || submitStatus === 'success' || oauthBusy) return;
    setFormError(null);
    setSubmitStatus('loading');
    try {
      const result = await login({
        email: values.email.trim(),
        password: values.password,
        rememberMe: values.rememberMe,
        website: values.website,
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
        router.push(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
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
      <Link
        href="/"
        className="hidden min-h-11 items-center text-foreground lg:inline-flex"
        aria-label={tNav('home')}
      >
        <Logo variant="icon" size={36} />
      </Link>

      <p className="ds-kicker lg:mt-8">{t('welcomeBack')}</p>
      <h1 className="ds-page-title mt-2">{t('loginTitle')}</h1>

      <form onSubmit={handleSubmit(onValid)} className="relative mt-6 space-y-4 lg:mt-8" noValidate>
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
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="login-email-error" message={issueMessage(errors.email, t)} />
        </div>
        <div>
          <Label htmlFor="login-password">{t('password')}</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            {...register('password')}
          />
          <FieldError id="login-password-error" message={issueMessage(errors.password, t)} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onChange={(checked) => setValue('rememberMe', checked)}
          >
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
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
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
