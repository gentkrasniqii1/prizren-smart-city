'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { PublicUser, UpdateProfileRequest } from '@prizren/shared-types';
import { updateProfileRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Badge, FieldError, FormError } from '@/components/ui';
import { useErrorMessage } from '@/lib/use-error-message';

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone?: string;
};

export function ProfileSettings({
  user,
  roleLabel,
  memberSince,
}: {
  user: PublicUser;
  roleLabel: string;
  memberSince: string;
}) {
  const t = useTranslations('Account');
  const tAuth = useTranslations('Auth');
  const { updateUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
    },
  });

  function startEdit() {
    reset({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
    });
    setFormError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setFormError(null);
  }

  async function onValid(values: ProfileFormValues) {
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: UpdateProfileRequest = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: values.phone?.trim() || undefined,
      };
      const updated = await apiFetch<PublicUser>('/users/me', {
        method: 'PATCH',
        auth: true,
        body: payload,
      });
      updateUser(updated);
      setEditing(false);
      toast.push(t('profileUpdateSuccess'), 'success');
    } catch (err) {
      setFormError(errorMessage(err, t('profileUpdateFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendVerification() {
    setVerifying(true);
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: { email: user.email },
      });
      toast.push(t('verifyEmailSent'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('verifyEmailFailed')), 'error');
    } finally {
      setVerifying(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit(onValid)} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-first-name">{tAuth('firstName')}</Label>
            <Input
              id="profile-first-name"
              autoComplete="given-name"
              invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? 'profile-first-name-error' : undefined}
              {...register('firstName')}
            />
            <FieldError
              id="profile-first-name-error"
              message={issueMessage(errors.firstName, tAuth)}
            />
          </div>
          <div>
            <Label htmlFor="profile-last-name">{tAuth('lastName')}</Label>
            <Input
              id="profile-last-name"
              autoComplete="family-name"
              invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? 'profile-last-name-error' : undefined}
              {...register('lastName')}
            />
            <FieldError
              id="profile-last-name-error"
              message={issueMessage(errors.lastName, tAuth)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="profile-phone">{tAuth('phoneOptional')}</Label>
          <Input id="profile-phone" type="tel" autoComplete="tel" {...register('phone')} />
        </div>

        <FormError message={formError} />

        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={submitting}>
            {t('profileSaveCta')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={cancel}
            disabled={submitting}
          >
            {t('profileCancelCta')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-stone-600">{t('profileName')}</dt>
          <dd className="font-medium text-stone-900">{user.name}</dd>
        </div>
        <div>
          <dt className="text-stone-600">{t('profileEmail')}</dt>
          <dd className="font-medium text-stone-900">{user.email}</dd>
        </div>
        <div>
          <dt className="text-stone-600">{t('profilePhone')}</dt>
          <dd className="font-medium text-stone-900">{user.phone || t('profilePhoneEmpty')}</dd>
        </div>
        <div>
          <dt className="text-stone-600">{t('profileRole')}</dt>
          <dd className="font-medium text-stone-900">{roleLabel}</dd>
        </div>
        <div>
          <dt className="text-stone-600">{t('profileSince')}</dt>
          <dd className="font-medium text-stone-900">{memberSince}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user.emailVerified ? (
          <Badge tone="success">{t('emailVerifiedBadge')}</Badge>
        ) : (
          <>
            <Badge tone="warning">{t('emailUnverifiedBadge')}</Badge>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={verifying}
              onClick={() => void sendVerification()}
            >
              {t('verifyEmailCta')}
            </Button>
          </>
        )}
        {user.googleLinked ? <Badge tone="info">{t('googleLinkedBadge')}</Badge> : null}
      </div>

      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={startEdit}>
        {t('profileEditCta')}
      </Button>
    </div>
  );
}
