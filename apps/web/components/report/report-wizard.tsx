'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CategoryDto, ReportDto } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import {
  createReportFormSchema,
  issueMessage,
  zodResolver,
  type CreateReportFormValues,
} from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { PageContainer } from '@/components/layout/page-container';
import { PhotoUploader } from '@/components/report/photo-uploader';
import { AddressSearch } from '@/components/report/address-search';
import { StepIndicator } from '@/components/report/step-indicator';
import { RemoteImage } from '@/components/remote-image';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { FieldError } from '@/components/ui/field-error';
import { FormError } from '@/components/ui/form-error';
import { Label, Select, Textarea } from '@/components/ui/field';
import { MapSkeleton, ReportFormSkeleton } from '@/components/ui/skeletons';
import { useErrorMessage } from '@/lib/use-error-message';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function LocationMapFallback() {
      return <MapSkeleton className="h-64 w-full rounded-md sm:h-72" />;
    },
  },
);

const STEP_IDS = ['describe', 'photo', 'location', 'category', 'review'] as const;

export function ReportWizard() {
  const t = useTranslations('ReportFlow');
  const router = useRouter();
  const { user, loading: authLoading, ensureSession } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [created, setCreated] = useState<ReportDto | null>(null);

  const {
    register,
    trigger,
    setValue,
    setError,
    clearErrors,
    watch,
    getValues,
    formState: { errors },
  } = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportFormSchema),
    defaultValues: {
      description: '',
      photo: null,
      address: '',
      categoryId: '',
      website: '',
    },
  });

  const description = watch('description');
  const categoryId = watch('categoryId');
  const address = watch('address') ?? '';
  const lat = watch('lat');
  const lng = watch('lng');
  const photo = watch('photo');

  const steps = useMemo(() => STEP_IDS.map((id) => ({ id, label: t(`steps.${id}`) })), [t]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    void apiFetch<CategoryDto[]>('/categories')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!(photo instanceof File)) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setError('lat', { type: 'manual', message: t('geoUnsupported') });
      return;
    }
    setGeoBusy(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('lat', pos.coords.latitude, { shouldValidate: true });
        setValue('lng', pos.coords.longitude, { shouldValidate: true });
        clearErrors(['lat', 'lng']);
        setGeoBusy(false);
      },
      () => {
        setError('lat', { type: 'manual', message: t('geoDenied') });
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function goNext() {
    setFormError(null);
    if (step === 0 && !(await trigger('description'))) return;
    if (step === 1 && !(await trigger('photo'))) return;
    if (step === 2 && !(await trigger(['lat', 'lng']))) return;
    setStep((s) => Math.min(s + 1, STEP_IDS.length - 1));
  }

  function goBack() {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setFormError(null);
    const ok = await trigger(['description', 'photo', 'lat', 'lng']);
    if (!ok) {
      const current = getValues();
      if (!current.description || current.description.trim().length < 10) setStep(0);
      else if (!(current.photo instanceof File)) setStep(1);
      else setStep(2);
      return;
    }

    const values = getValues();
    if (!(values.photo instanceof File) || values.lat == null || values.lng == null) return;

    const form = new FormData();
    form.append('photo', values.photo);
    form.append('description', values.description.trim());
    form.append('lat', String(values.lat));
    form.append('lng', String(values.lng));
    if (values.address?.trim()) form.append('address', values.address.trim());
    if (values.categoryId) form.append('categoryId', values.categoryId);
    form.append('website', values.website ?? '');

    setSubmitting(true);
    try {
      const sessionOk = await ensureSession();
      if (!sessionOk) {
        setFormError(t('sessionExpired'));
        router.replace('/login');
        return;
      }

      const report = await apiFetch<ReportDto>('/reports', {
        method: 'POST',
        body: form,
        auth: true,
        networkRetries: 1,
      });
      toast.push(t('successToast'), 'success');
      setCreated(report);
    } catch (err) {
      setFormError(errorMessage(err, t('submitFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main>
        <ReportFormSkeleton label={t('loading')} />
      </main>
    );
  }

  if (created) {
    return (
      <main className="pb-bottom-nav pt-6 sm:pt-8">
        <PageContainer width="narrow">
          <div
            className="motion-fade-in rounded-xl border border-border bg-card p-6 text-center sm:p-10"
            role="status"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-river-600" aria-hidden />
            <h1 className="ds-page-title mt-4">{t('successTitle')}</h1>
            <p className="mt-2 text-muted-foreground">{t('successBody')}</p>

            <dl className="mx-auto mt-6 max-w-sm space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-left text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('successId')}</dt>
                <dd className="font-mono text-xs font-medium text-foreground sm:text-sm">
                  {created.id}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t('successStatus')}</dt>
                <dd>
                  <StatusBadge status={created.status} />
                </dd>
              </div>
              {created.institutionName ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('successInstitution')}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {created.institutionName}
                  </dd>
                </div>
              ) : null}
              {created.departmentName ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t('successDepartment')}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {created.departmentName}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-4 text-sm text-muted-foreground">{t('successAiNote')}</p>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href={`/reports/${created.id}`}>
                <Button className="w-full sm:w-auto">{t('successViewReport')}</Button>
              </Link>
              <Link href="/reports">
                <Button variant="secondary" className="w-full sm:w-auto">
                  {t('successBackToList')}
                </Button>
              </Link>
            </div>
          </div>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <h1 className="ds-page-title">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>

        <div className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-6">
          <StepIndicator steps={steps} current={step} />

          <div key={step} className="motion-fade-in mt-8">
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="report-description">{t('descriptionLabel')}</Label>
                  <Textarea
                    id="report-description"
                    rows={6}
                    invalid={Boolean(errors.description)}
                    aria-describedby={
                      errors.description ? 'report-description-error' : 'report-description-hint'
                    }
                    placeholder={t('descriptionPlaceholder')}
                    {...register('description')}
                  />
                  <p id="report-description-hint" className="mt-1.5 text-xs text-muted-foreground">
                    {t('descriptionHint')}
                  </p>
                  <FieldError
                    id="report-description-error"
                    message={issueMessage(errors.description, t)}
                  />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                <div>
                  <Label>{t('photoLabel')}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">{t('photoIntro')}</p>
                </div>
                <PhotoUploader
                  preview={preview}
                  error={issueMessage(errors.photo, t)}
                  onFile={(file, err) => {
                    setValue('photo', file, { shouldValidate: !err });
                    if (err) setError('photo', { type: 'manual', message: err });
                    else clearErrors('photo');
                  }}
                  onClear={() => {
                    setValue('photo', null, { shouldValidate: true });
                    clearErrors('photo');
                  }}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div>
                    <p id="report-location-label" className="text-label text-foreground">
                      {t('locationLabel')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t('locationIntro')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={requestGeolocation}
                    status={geoBusy ? 'loading' : 'idle'}
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {geoBusy ? t('locating') : t('useGps')}
                  </Button>
                </div>

                <div
                  aria-labelledby="report-location-label"
                  aria-describedby={errors.lat || errors.lng ? 'report-location-error' : undefined}
                >
                  <LocationPickerMap
                    lat={lat ?? null}
                    lng={lng ?? null}
                    onPick={(nextLat, nextLng) => {
                      setValue('lat', nextLat, { shouldValidate: true });
                      setValue('lng', nextLng, { shouldValidate: true });
                      clearErrors(['lat', 'lng']);
                    }}
                  />
                </div>
                <FieldError
                  id="report-location-error"
                  message={issueMessage(errors.lat, t) ?? issueMessage(errors.lng, t)}
                />
                <p className="text-xs text-muted-foreground">
                  {lat != null && lng != null
                    ? t('coords', { lat: lat.toFixed(5), lng: lng.toFixed(5) })
                    : t('locationHint')}
                </p>

                <AddressSearch
                  value={address}
                  onChange={(next) => setValue('address', next)}
                  onPick={(nextLat, nextLng, label) => {
                    setValue('lat', nextLat, { shouldValidate: true });
                    setValue('lng', nextLng, { shouldValidate: true });
                    setValue('address', label);
                    clearErrors(['lat', 'lng']);
                  }}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="report-category">{t('categoryLabel')}</Label>
                  <Select id="report-category" {...register('categoryId')}>
                    <option value="">{t('categoryNone')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">{t('categoryHint')}</p>
                </div>

                <div className="rounded-lg border border-mosque-200 bg-mosque-50/70 p-4">
                  <div className="flex gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-mosque-950">{t('aiTitle')}</p>
                      <p className="mt-1 text-sm leading-relaxed text-mosque-900/80">
                        {t('aiBody')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">{t('reviewIntro')}</p>

                <dl className="space-y-4 rounded-lg border border-border bg-muted/80 p-4 text-sm">
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-muted-foreground">
                      {t('steps.describe')}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-foreground">{description}</dd>
                  </div>
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-muted-foreground">
                      {t('steps.photo')}
                    </dt>
                    <dd className="mt-2">
                      {preview ? (
                        <RemoteImage
                          src={preview}
                          alt={t('photoPreviewAlt')}
                          className="max-h-40 w-full rounded-md border object-cover"
                        />
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-muted-foreground">
                      {t('steps.location')}
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {lat != null && lng != null
                        ? t('coords', { lat: lat.toFixed(5), lng: lng.toFixed(5) })
                        : '—'}
                      {address.trim() ? ` · ${address.trim()}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-muted-foreground">
                      {t('steps.category')}
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {selectedCategory?.name ?? t('categoryNone')}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  {t('afterSubmit')}
                </div>
              </div>
            ) : null}
          </div>

          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
            </label>
          </div>

          <FormError className="mt-4" message={formError} />

          <div className="sticky bottom-[var(--bottom-nav-h)] z-10 -mx-4 mt-8 border-t border-border bg-card/95 px-4 py-4 backdrop-blur-sm md:static md:bottom-auto md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={step === 0 || submitting}
                className="w-full sm:w-auto"
              >
                {t('back')}
              </Button>
              {step < STEP_IDS.length - 1 ? (
                <Button type="button" onClick={() => void goNext()} className="w-full sm:w-auto">
                  {t('next')}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void submit()}
                  status={submitting ? 'loading' : 'idle'}
                  className="w-full sm:w-auto"
                >
                  {submitting ? t('submitting') : t('submit')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
