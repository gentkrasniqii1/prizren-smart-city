'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { isPasswordStrong } from '@/lib/password';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Checkbox, FieldError } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

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
  const [submitting, setSubmitting] = useState(false);

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
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
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
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('registerFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell imageSrc="/images/prizren/stone-bridge.jpg" imageAlt={t('registerPanelAlt')}>
      <h1 className="text-h1 tracking-tight text-foreground">{t('registerTitle')}</h1>
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

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {submitting ? t('registering') : t('submitRegister')}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t('orContinue')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <OAuthButtons disabled={submitting} />

      <p className="mt-6 text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('loginTitle')}
        </Link>
      </p>
    </AuthShell>
  );
}
