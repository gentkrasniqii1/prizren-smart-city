'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PublicUser } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { isPasswordStrong } from '@/lib/password';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { FieldError, FormError } from '@/components/ui';
import { useErrorMessage } from '@/lib/use-error-message';

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function ChangePasswordForm({ user }: { user: PublicUser }) {
  const t = useTranslations('Account');
  const tAuth = useTranslations('Auth');
  const router = useRouter();
  const { logout } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!currentPassword) next.currentPassword = t('currentPasswordRequired');
    if (!newPassword) next.newPassword = tAuth('passwordRequired');
    else if (!isPasswordStrong(newPassword)) next.newPassword = tAuth('passwordWeak');
    if (confirmPassword !== newPassword) next.confirmPassword = tAuth('passwordMismatch');
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        auth: true,
        body: { currentPassword, newPassword },
      });
      toast.push(t('changePasswordSuccess'), 'success');
      // The API revokes every session (including this one) on password change.
      await logout();
      router.push('/login');
    } catch (err) {
      setFormError(errorMessage(err, t('changePasswordFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-h3 text-foreground">{t('passwordHeading')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('passwordBody')}</p>

      {!user.hasPassword ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('noPasswordSet')}</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              invalid={Boolean(fieldErrors.currentPassword)}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, currentPassword: undefined }));
              }}
            />
            <FieldError message={fieldErrors.currentPassword} />
          </div>
          <div>
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              invalid={Boolean(fieldErrors.newPassword)}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, newPassword: undefined }));
              }}
            />
            <PasswordStrength password={newPassword} />
            <FieldError message={fieldErrors.newPassword} />
          </div>
          <div>
            <Label htmlFor="confirm-new-password">{t('confirmNewPassword')}</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              invalid={Boolean(fieldErrors.confirmPassword)}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
              }}
            />
            <FieldError message={fieldErrors.confirmPassword} />
          </div>

          <FormError message={formError} />

          <Button
            type="submit"
            size="sm"
            status={submitting ? 'loading' : formError ? 'error' : 'idle'}
          >
            {t('changePasswordCta')}
          </Button>
        </form>
      )}
    </section>
  );
}
