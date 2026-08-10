'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { FieldError } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

type FieldErrors = { name?: string; email?: string; password?: string };

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = t('nameMin');
    if (!email.trim()) next.email = t('emailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('emailInvalid');
    if (!password) next.password = t('passwordRequired');
    else if (password.length < 8) next.password = t('passwordMin');
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, website });
      router.push('/account');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-6xl lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/prizren/stone-bridge.jpg"
          alt={t('panelAlt')}
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-stone-950/20" />
      </div>

      <div className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-950">
          {t('registerTitle')}
        </h1>
        <p className="mt-2 text-stone-600">{t('registerSubtitle')}</p>

        <div className="mt-8 space-y-4">
          <GoogleSignInButton label={t('google')} />
          <p className="text-center text-xs uppercase tracking-wider text-stone-400">
            {t('orEmail')}
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="register-name">{t('name')}</Label>
            <Input
              id="register-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((f) => ({ ...f, name: undefined }));
              }}
            />
            <FieldError message={fieldErrors.name} />
          </div>
          <div>
            <Label htmlFor="register-email">{t('email')}</Label>
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((f) => ({ ...f, email: undefined }));
              }}
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <div>
            <Label htmlFor="register-password">{t('password')}</Label>
            <Input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, password: undefined }));
              }}
            />
            <FieldError message={fieldErrors.password} />
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
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('registering') : t('submitRegister')}
          </Button>
        </form>

        <p className="mt-6 text-sm text-stone-600">
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-mosque-800 underline">
            {t('loginTitle')}
          </Link>
        </p>
      </div>
    </main>
  );
}
