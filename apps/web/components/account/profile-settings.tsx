'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { PublicUser, UpdateProfileRequest } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { FieldError } from '@/components/ui';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
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

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function startEdit() {
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setPhone(user.phone ?? '');
    setFieldErrors({});
    setFormError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setFieldErrors({});
    setFormError(null);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (firstName.trim().length < 2) next.firstName = tAuth('nameMin');
    if (lastName.trim().length < 2) next.lastName = tAuth('nameMin');
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
      const payload: UpdateProfileRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
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
      setFormError(err instanceof ApiError ? err.message : t('profileUpdateFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-first-name">{tAuth('firstName')}</Label>
            <Input
              id="profile-first-name"
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
            <Label htmlFor="profile-last-name">{tAuth('lastName')}</Label>
            <Input
              id="profile-last-name"
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
          <Label htmlFor="profile-phone">{tAuth('phoneOptional')}</Label>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

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

      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={startEdit}>
        {t('profileEditCta')}
      </Button>
    </div>
  );
}
