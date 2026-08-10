'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { FieldError } from '@/components/ui';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = 'Email është i detyrueshëm';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Email i pavlefshëm';
    }
    if (!password) next.password = 'Fjalëkalimi është i detyrueshëm';
    else if (password.length < 8) next.password = 'Të paktën 8 karaktere';
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
      await login({ email: email.trim(), password, website });
      router.push('/account');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Hyrja dështoi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Hyr</h1>
      <p className="mt-2 text-stone-600">Hyni në llogarinë tuaj të Prizren Smart City.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="login-email" className="block text-sm text-stone-700">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((f) => ({ ...f, email: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
          />
          <FieldError id="login-email-error" message={fieldErrors.email} />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm text-stone-700">
            Fjalëkalimi
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
          />
          <FieldError id="login-password-error" message={fieldErrors.password} />
        </div>

        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {submitting ? 'Duke hyrë…' : 'Hyr'}
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-600">
        Nuk ke llogari?{' '}
        <Link href="/register" className="font-medium text-stone-900 underline">
          Regjistrohu
        </Link>
      </p>
    </main>
  );
}
