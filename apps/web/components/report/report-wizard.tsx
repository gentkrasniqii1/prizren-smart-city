'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CategoryDto, ReportDto } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageContainer } from '@/components/layout/page-container';
import { PhotoUploader } from '@/components/report/photo-uploader';
import { StepIndicator } from '@/components/report/step-indicator';
import { RemoteImage } from '@/components/remote-image';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function MapLoading() {
      return <Skeleton className="h-64 w-full rounded-md sm:h-72" />;
    },
  },
);

type FieldErrors = {
  description?: string;
  photo?: string;
  location?: string;
};

const STEP_IDS = ['describe', 'photo', 'location', 'category', 'review'] as const;

export function ReportWizard() {
  const t = useTranslations('ReportFlow');
  const router = useRouter();
  const { user, loading: authLoading, ensureSession } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

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
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setFormError(t('geoUnsupported'));
      return;
    }
    setGeoBusy(true);
    setFormError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setFieldErrors((f) => ({ ...f, location: undefined }));
        setGeoBusy(false);
      },
      () => {
        setFormError(t('geoDenied'));
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function validateStep(index: number): FieldErrors {
    const next: FieldErrors = {};
    if (index === 0 && description.trim().length < 10) {
      next.description = t('descriptionError');
    }
    if (index === 1 && !photo) {
      next.photo = t('photoRequired');
    }
    if (index === 2 && (lat === null || lng === null)) {
      next.location = t('locationRequired');
    }
    return next;
  }

  function goNext() {
    setFormError(null);
    const errors = validateStep(step);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep((s) => Math.min(s + 1, STEP_IDS.length - 1));
  }

  function goBack() {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setFormError(null);
    const all: FieldErrors = {
      ...validateStep(0),
      ...validateStep(1),
      ...validateStep(2),
    };
    setFieldErrors(all);
    if (Object.keys(all).length > 0) {
      if (all.description) setStep(0);
      else if (all.photo) setStep(1);
      else if (all.location) setStep(2);
      return;
    }

    const form = new FormData();
    form.append('photo', photo!);
    form.append('description', description.trim());
    form.append('lat', String(lat));
    form.append('lng', String(lng));
    if (address.trim()) form.append('address', address.trim());
    if (categoryId) form.append('categoryId', categoryId);
    form.append('website', website);

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
      router.push(`/reports/${report.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <Spinner label={t('loading')} />
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="narrow">
        <h1 className="font-display text-h1 tracking-tight text-stone-950 sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-2 text-stone-600">{t('subtitle')}</p>

        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-4 sm:p-6">
          <StepIndicator steps={steps} current={step} />

          <div key={step} className="motion-fade-in mt-8">
            {step === 0 ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="report-description">{t('descriptionLabel')}</Label>
                  <Textarea
                    id="report-description"
                    rows={6}
                    value={description}
                    invalid={Boolean(fieldErrors.description)}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setFieldErrors((f) => ({ ...f, description: undefined }));
                    }}
                    aria-describedby={
                      fieldErrors.description
                        ? 'report-description-error'
                        : 'report-description-hint'
                    }
                    placeholder={t('descriptionPlaceholder')}
                  />
                  <p id="report-description-hint" className="mt-1.5 text-xs text-stone-500">
                    {t('descriptionHint')}
                  </p>
                  <FieldError id="report-description-error" message={fieldErrors.description} />
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                <div>
                  <Label>{t('photoLabel')}</Label>
                  <p className="mt-1 text-sm text-stone-600">{t('photoIntro')}</p>
                </div>
                <PhotoUploader
                  preview={preview}
                  error={fieldErrors.photo}
                  onFile={(file, err) => {
                    setPhoto(file);
                    setFieldErrors((f) => ({
                      ...f,
                      photo: err,
                    }));
                  }}
                  onClear={() => {
                    setPhoto(null);
                    setFieldErrors((f) => ({ ...f, photo: undefined }));
                  }}
                />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p id="report-location-label" className="text-label text-stone-700">
                      {t('locationLabel')}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{t('locationIntro')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={requestGeolocation}
                    disabled={geoBusy}
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {geoBusy ? t('locating') : t('useGps')}
                  </Button>
                </div>

                <div aria-labelledby="report-location-label">
                  <LocationPickerMap
                    lat={lat}
                    lng={lng}
                    onPick={(nextLat, nextLng) => {
                      setLat(nextLat);
                      setLng(nextLng);
                      setFieldErrors((f) => ({ ...f, location: undefined }));
                    }}
                  />
                </div>
                <FieldError id="report-location-error" message={fieldErrors.location} />
                <p className="text-xs text-stone-500">
                  {lat !== null && lng !== null
                    ? t('coords', { lat: lat.toFixed(5), lng: lng.toFixed(5) })
                    : t('locationHint')}
                </p>

                <div>
                  <Label htmlFor="report-address">{t('addressLabel')}</Label>
                  <Input
                    id="report-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('addressPlaceholder')}
                  />
                  <p className="mt-1.5 text-xs text-stone-500">{t('addressHint')}</p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div>
                  <Label htmlFor="report-category">{t('categoryLabel')}</Label>
                  <Select
                    id="report-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">{t('categoryNone')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-xs text-stone-500">{t('categoryHint')}</p>
                </div>

                <div className="rounded-lg border border-mosque-200 bg-mosque-50/70 p-4">
                  <div className="flex gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mosque-700 text-white">
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
                <p className="text-sm text-stone-600">{t('reviewIntro')}</p>

                <dl className="space-y-4 rounded-lg border border-stone-200 bg-stone-50/80 p-4 text-sm">
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-stone-500">
                      {t('steps.describe')}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-stone-900">{description}</dd>
                  </div>
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-stone-500">
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
                    <dt className="text-caption uppercase tracking-wide text-stone-500">
                      {t('steps.location')}
                    </dt>
                    <dd className="mt-1 text-stone-900">
                      {lat !== null && lng !== null
                        ? t('coords', { lat: lat.toFixed(5), lng: lng.toFixed(5) })
                        : '—'}
                      {address.trim() ? ` · ${address.trim()}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption uppercase tracking-wide text-stone-500">
                      {t('steps.category')}
                    </dt>
                    <dd className="mt-1 text-stone-900">
                      {selectedCategory?.name ?? t('categoryNone')}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
                  {t('afterSubmit')}
                </div>
              </div>
            ) : null}
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
            <p className="mt-4 text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-stone-100 bg-white/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
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
                <Button type="button" onClick={goNext} className="w-full sm:w-auto">
                  {t('next')}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
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
