'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryDto, ReportDto } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function MapLoading() {
      return <div className="h-64 animate-pulse rounded-md bg-stone-200" />;
    },
  },
);

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
  const [error, setError] = useState<string | null>(null);
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
      setError('Geolocation nuk mbështetet në këtë shfletues');
      return;
    }
    setGeoBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGeoBusy(false);
      },
      () => {
        setError('Nuk u mor lokacioni. Lejo aksesin ose kliko në hartë.');
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!photo) {
      setError('Fotoja është e detyrueshme');
      return;
    }
    if (lat === null || lng === null) {
      setError('Zgjidh lokacionin (GPS ose klik në hartë)');
      return;
    }
    if (description.trim().length < 10) {
      setError('Përshkrimi duhet të ketë të paktën 10 karaktere');
      return;
    }

    const form = new FormData();
    form.append('photo', photo);
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
      setError(err instanceof ApiError ? err.message : 'Dërgimi dështoi');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-stone-600">Duke ngarkuar...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Raporto një problem</h1>
      <p className="mt-2 text-stone-600">Shto foto, lokacion dhe një përshkrim të shkurtër.</p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-stone-700">Përshkrimi</span>
            <textarea
              required
              minLength={10}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
              placeholder="P.sh. gropë e madhe në rrugë..."
            />
          </label>

          <label className="block text-sm">
            <span className="text-stone-700">Kategoria (opsionale)</span>
            <select
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
          </label>

          <label className="block text-sm">
            <span className="text-stone-700">Adresa (opsionale)</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
            />
          </label>

          <label className="block text-sm">
            <span className="text-stone-700">Foto (JPEG/PNG/WebP, max 5MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Parapamje e fotos"
              className="max-h-48 rounded-md border object-cover"
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-stone-700">Lokacioni</p>
            <button
              type="button"
              onClick={requestGeolocation}
              disabled={geoBusy}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60"
            >
              {geoBusy ? 'Duke gjetur...' : 'Përdor GPS'}
            </button>
          </div>
          <LocationPickerMap
            lat={lat}
            lng={lng}
            onPick={(nextLat, nextLng) => {
              setLat(nextLat);
              setLng(nextLng);
            }}
          />
          <p className="text-xs text-stone-500">
            {lat !== null && lng !== null
              ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : 'Kliko në hartë ose përdor GPS'}
          </p>
        </div>

        <div className="md:col-span-2 space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-stone-900 px-5 py-2.5 text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {submitting ? 'Duke dërguar...' : 'Dërgo raportin'}
          </button>
        </div>
      </form>
    </main>
  );
}
