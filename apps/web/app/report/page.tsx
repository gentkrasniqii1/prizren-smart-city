'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryDto, ReportDto } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { FieldError, Spinner } from '@/components/ui';
import { RemoteImage } from '@/components/remote-image';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function MapLoading() {
      return <div className="h-64 animate-pulse rounded-md bg-stone-200 sm:h-72" />;
    },
  },
);

type FieldErrors = {
  description?: string;
  photo?: string;
  location?: string;
};

export default function ReportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
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
      setFormError('Geolocation nuk mbështetet në këtë shfletues');
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
        setFormError('Nuk u mor lokacioni. Lejo aksesin ose kliko në hartë.');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (description.trim().length < 10) {
      next.description = 'Përshkrimi duhet të ketë të paktën 10 karaktere';
    }
    if (!photo) next.photo = 'Fotoja është e detyrueshme';
    if (lat === null || lng === null) {
      next.location = 'Zgjidh lokacionin (GPS ose klik në hartë)';
    }
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

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
      const report = await apiFetch<ReportDto>('/reports', {
        method: 'POST',
        body: form,
        auth: true,
      });
      router.push(`/reports/${report.id}`);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Dërgimi dështoi');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        Raporto një problem
      </h1>
      <p className="mt-2 text-stone-600">Shto foto, lokacion dhe një përshkrim të shkurtër.</p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 md:grid-cols-2" noValidate>
        <div className="space-y-4">
          <div>
            <label htmlFor="report-description" className="block text-sm text-stone-700">
              Përshkrimi
            </label>
            <textarea
              id="report-description"
              minLength={10}
              rows={5}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFieldErrors((f) => ({ ...f, description: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'report-description-error' : undefined}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
              placeholder="P.sh. gropë e madhe në rrugë..."
            />
            <FieldError id="report-description-error" message={fieldErrors.description} />
          </div>

          <div>
            <label htmlFor="report-category" className="block text-sm text-stone-700">
              Kategoria (opsionale)
            </label>
            <select
              id="report-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            >
              <option value="">Zgjidh...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-address" className="block text-sm text-stone-700">
              Adresa (opsionale)
            </label>
            <input
              id="report-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label htmlFor="report-photo" className="block text-sm text-stone-700">
              Foto (JPEG/PNG/WebP, max 5MB)
            </label>
            <input
              id="report-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setPhoto(e.target.files?.[0] ?? null);
                setFieldErrors((f) => ({ ...f, photo: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.photo)}
              aria-describedby={fieldErrors.photo ? 'report-photo-error' : undefined}
              className="mt-1 block w-full text-sm"
            />
            <FieldError id="report-photo-error" message={fieldErrors.photo} />
          </div>
          {preview ? (
            <RemoteImage
              src={preview}
              alt="Parapamje e fotos së raportit"
              className="max-h-48 w-full rounded-md border object-cover"
            />
          ) : null}

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
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="report-location-label" className="text-sm text-stone-700">
              Lokacioni
            </p>
            <button
              type="button"
              onClick={requestGeolocation}
              disabled={geoBusy}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60"
            >
              {geoBusy ? 'Duke gjetur...' : 'Përdor GPS'}
            </button>
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
              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : 'Kliko në hartë ose përdor GPS'}
          </p>
        </div>

        <div className="space-y-3 md:col-span-2">
          {formError ? (
            <p className="text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-stone-900 px-5 py-2.5 text-white hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
          >
            {submitting ? 'Duke dërguar...' : 'Dërgo raportin'}
          </button>
        </div>
      </form>
    </main>
  );
}
