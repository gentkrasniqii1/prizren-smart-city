'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isPasswordStrong } from '@/lib/password';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Checkbox, FieldError, FormError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
};

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { register } = useAuth();
  const errorMessage = useErrorMessage();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');
  const [oauthBusy, setOauthBusy] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (firstName.trim().length < 2) next.firstName = t('nameMin');
    if (lastName.trim().length < 2) next.lastName = t('nameMin');
    if (!email.trim()) next.email = t('emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('emailInvalid');
    if (!password) next.password = t('passwordRequired');
    else if (!isPasswordStrong(password)) next.password = t('passwordWeak');
    if (confirm !== password) next.confirm = t('passwordMismatch');
    if (!accepted) next.terms = t('termsRequired');
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
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        acceptedTerms: true,
        website,
      });
      setSubmitStatus('success');
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setFormError(errorMessage(err, t('registerFailed')));
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell
      imageSrc="/images/prizren/stone-bridge.jpg"
      imageAlt={t('registerPanelAlt')}
      headline={t('panelHeadline')}
      body={t('panelBody')}
    >
      <h1 className="ds-page-title">{t('registerTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('registerSubtitle')}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('accountType')}: <span className="font-medium text-foreground">{t('citizenRole')}</span>
      </p>

      <form onSubmit={onSubmit} className="relative mt-8 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first-name">{t('firstName')}</Label>
            <Input
              id="first-name"
              autoComplete="given-name"
              value={firstName}
              invalid={Boolean(fieldErrors.firstName)}
              onChange={(e) => {
                setFirstName(e.target.value);
                setFieldErrors((f) => ({ ...f, firstName: undefined }));
              }}
            />
            <FieldError message={fieldErrors.firstName} />
          </div>
          <div>
            <Label htmlFor="last-name">{t('lastName')}</Label>
            <Input
              id="last-name"
              autoComplete="family-name"
              value={lastName}
              invalid={Boolean(fieldErrors.lastName)}
              onChange={(e) => {
                setLastName(e.target.value);
                setFieldErrors((f) => ({ ...f, lastName: undefined }));
              }}
            />
            <FieldError message={fieldErrors.lastName} />
          </div>
        </div>
        <div>
          <Label htmlFor="register-email">{t('email')}</Label>
          <Input
            id="register-email"
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
          <Label htmlFor="register-phone">{t('phoneOptional')}</Label>
          <Input
            id="register-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="register-password">{t('password')}</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
          />
          <PasswordStrength password={password} />
          <FieldError message={fieldErrors.password} />
        </div>
        <div>
          <Label htmlFor="register-confirm">{t('confirmPassword')}</Label>
          <Input
            id="register-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            invalid={Boolean(fieldErrors.confirm)}
            onChange={(e) => {
              setConfirm(e.target.value);
              setFieldErrors((f) => ({ ...f, confirm: undefined }));
            }}
          />
          <FieldError message={fieldErrors.confirm} />
        </div>

        <Checkbox
          id="terms"
          checked={accepted}
          onChange={(v) => {
            setAccepted(v);
            setFieldErrors((f) => ({ ...f, terms: undefined }));
          }}
        >
          {t('agreePrefix')}{' '}
          <Link href="/privacy" className="font-medium text-primary hover:underline">
            {t('privacy')}
          </Link>{' '}
          {t('and')}{' '}
          <Link href="/terms" className="font-medium text-primary hover:underline">
            {t('terms')}
          </Link>
        </Checkbox>
        <FieldError message={fieldErrors.terms} />

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
          {submitStatus === 'loading' ? t('registering') : t('submitRegister')}
        </Button>
      </form>

      <OAuthButtons
        disabled={submitStatus === 'loading' || submitStatus === 'success'}
        onBusyChange={setOauthBusy}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('loginCta')}
        </Link>
      </p>
    </AuthShell>
  );
}
