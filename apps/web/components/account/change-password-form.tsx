'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { PublicUser } from '@prizren/shared-types';
import { changePasswordFormSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { PasswordStrength } from '@/components/auth/password-strength';
import { FieldError, FormError, PasswordInput } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ChangePasswordForm({ user }: { user: PublicUser }) {
  const t = useTranslations('Account');
  const tAuth = useTranslations('Auth');
  const router = useRouter();
  const { logout } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const canSetPassword = Boolean(user.email) && !user.needsEmail;

  async function sendSetPasswordEmail() {
    if (resetSending || resetSent || !canSetPassword) return;
    setResetError(null);
    setResetSending(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: user.email.trim(), website: '' },
      });
      setResetSent(true);
    } catch (err) {
      setResetError(errorMessage(err, t('setPasswordFailed')));
    } finally {
      setResetSending(false);
    }
  }

  async function onValid(values: ChangePasswordFormValues) {
    if (submitting) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        auth: true,
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast.push(t('changePasswordSuccess'), 'success');
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
      <p className="mt-1 text-sm text-muted-foreground">
        {user.hasPassword ? t('passwordBody') : t('setPasswordHint')}
      </p>

      {!user.hasPassword ? (
        <div className="mt-4 space-y-3">
          {resetSent ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">{t('setPasswordSentTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('setPasswordSentBody', { email: user.email })}
              </p>
            </div>
          ) : (
            <>
              {!canSetPassword ? (
                <p className="text-sm text-muted-foreground">{t('setPasswordNeedEmail')}</p>
              ) : null}
              <FormError message={resetError} />
              <Button
                type="button"
                size="sm"
                disabled={!canSetPassword}
                status={resetSending ? 'loading' : resetError ? 'error' : 'idle'}
                onClick={() => void sendSetPasswordEmail()}
              >
                {t('setPasswordCta')}
              </Button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="current-password">{t('currentPassword')}</Label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              invalid={Boolean(errors.currentPassword)}
              aria-describedby={errors.currentPassword ? 'current-password-error' : undefined}
              {...register('currentPassword')}
            />
            <FieldError
              id="current-password-error"
              message={issueMessage(errors.currentPassword, t, tAuth)}
            />
          </div>
          <div>
            <Label htmlFor="new-password">{t('newPassword')}</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              invalid={Boolean(errors.newPassword)}
              aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
              {...register('newPassword')}
            />
            <PasswordStrength password={newPassword} />
            <FieldError
              id="new-password-error"
              message={issueMessage(errors.newPassword, tAuth, t)}
            />
          </div>
          <div>
            <Label htmlFor="confirm-new-password">{t('confirmNewPassword')}</Label>
            <PasswordInput
              id="confirm-new-password"
              autoComplete="new-password"
              invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? 'confirm-new-password-error' : undefined}
              {...register('confirmPassword')}
            />
            <FieldError
              id="confirm-new-password-error"
              message={issueMessage(errors.confirmPassword, tAuth, t)}
            />
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
