'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import type { PublicUser, UpdateProfileRequest } from '@prizren/shared-types';
import { updateProfileRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Badge, FieldError, FormError } from '@/components/ui';
import { useErrorMessage } from '@/lib/use-error-message';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  async function onAvatarFile(file: File) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      toast.push(t('avatarInvalidType'), 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.push(t('avatarTooLarge'), 'error');
      return;
    }
    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const updated = await apiFetch<PublicUser>('/users/me/avatar', {
        method: 'PATCH',
        auth: true,
        body,
      });
      updateUser(updated);
      toast.push(t('avatarUploadSuccess'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('avatarUploadFailed')), 'error');
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const updated = await apiFetch<PublicUser>('/users/me/avatar', {
        method: 'DELETE',
        auth: true,
      });
      updateUser(updated);
      toast.push(t('avatarRemoveSuccess'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('avatarRemoveFailed')), 'error');
    } finally {
      setAvatarBusy(false);
    }
  }

  const avatarBlock = (
    <div className="mb-5 flex items-center gap-4">
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={64} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{t('avatarHeading')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('avatarHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onAvatarFile(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={avatarBusy}
            onClick={() => avatarInputRef.current?.click()}
          >
            {user.avatarUrl ? t('avatarChangeCta') : t('avatarUploadCta')}
          </Button>
          {user.avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={avatarBusy}
              onClick={() => void removeAvatar()}
            >
              {t('avatarRemoveCta')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (editing) {
    return (
      <div className="mt-4">
        {avatarBlock}
        <form onSubmit={handleSubmit(onValid)} className="space-y-4" noValidate>
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
      </div>
    );
  }

  return (
    <div className="mt-4">
      {avatarBlock}
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-stone-600">{t('profileName')}</dt>
          <dd className="font-medium text-stone-900">{user.name}</dd>
        </div>
        <div>
          <dt className="text-stone-600">{t('profileEmail')}</dt>
          <dd className="font-medium text-stone-900">
            {user.needsEmail ? t('emailMissing') : user.email}
          </dd>
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

      {user.needsEmail ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t('emailMissingHint')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {user.emailVerified && !user.needsEmail ? (
          <Badge tone="success">{t('emailVerifiedBadge')}</Badge>
        ) : user.needsEmail ? null : (
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
        {user.facebookLinked ? <Badge tone="info">{t('facebookLinkedBadge')}</Badge> : null}
      </div>

      {!user.needsEmail && (!user.googleLinked || !user.facebookLinked) ? (
        <div className="mt-6 rounded-md border border-border p-3">
          <p className="text-sm font-medium text-foreground">{t('linkedAccountsHeading')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('linkedAccountsBody')}</p>
          <div className="mt-3 max-w-sm">
            <OAuthButtons
              variant="link"
              linked={{ google: user.googleLinked, facebook: Boolean(user.facebookLinked) }}
            />
          </div>
        </div>
      ) : null}

      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={startEdit}>
        {t('profileEditCta')}
      </Button>
    </div>
  );
}
