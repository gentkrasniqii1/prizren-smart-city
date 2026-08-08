'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaginatedReports, ReportDto } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { colorForCategory } from '@/components/reports-map';

const ReportsMap = dynamic(
  () => import('@/components/reports-map').then((m) => m.ReportsMap),
  {
    ssr: false,
    loading: function MapSkeleton() {
      return <div className="h-full min-h-[320px] animate-pulse rounded-md bg-stone-200" />;
    },
  },
);

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearbyKm, setNearbyKm] = useState('');
  const [nearbyBusy, setNearbyBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = status ? `?limit=100&status=${encodeURIComponent(status)}` : '?limit=100';
        const res = await apiFetch<PaginatedReports>(`/reports${qs}`);
        setReports(res.data);
      } catch {
        setError('Nuk u ngarkuan raportet');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  async function loadNearby() {
    const km = Number(nearbyKm);
    if (!Number.isFinite(km) || km <= 0) {
      setError('Shkruaj radius te vlefshem ne km');
      return;
    }
    if (!navigator.geolocation) {
      setError('Geolocation nuk mbeshtetet');
      return;
    }
    setNearbyBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await apiFetch<ReportDto[]>(
            `/reports/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radiusKm=${km}`,
          );
          setReports(data);
          setSelectedId(null);
        } catch {
          setError('Nearby query deshtoi');
        } finally {
          setNearbyBusy(false);
        }
      },
      () => {
        setError('Nuk u mor GPS per nearby');
        setNearbyBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Raportet</h1>
          <p className="mt-2 text-stone-600">Harta dhe lista publike — pa te dhena personale.</p>
        </div>
        <Link href="/report" className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
          Raporto
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-stone-600">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-2 rounded-md border border-stone-300 px-2 py-1.5"
          >
            <option value="">Te gjitha</option>
            <option value="PENDING">PENDING</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="text-stone-600">Nearby (km)</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={nearbyKm}
            onChange={(e) => setNearbyKm(e.target.value)}
            placeholder="2"
            className="ml-2 w-20 rounded-md border border-stone-300 px-2 py-1.5"
          />
        </label>
        <button
          type="button"
          onClick={() => void loadNearby()}
          disabled={nearbyBusy}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60"
        >
          {nearbyBusy ? 'Duke kerkuar...' : 'Afisho prane meje'}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-stretch">
        <div className="min-h-[420px] lg:min-h-[560px]">
          <ReportsMap
            reports={reports}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              router.push(`/reports/${id}`);
            }}
          />
        </div>

        <div className="flex max-h-[560px] flex-col overflow-hidden rounded-md border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-3 py-2 text-sm text-stone-600">
            {loading ? 'Duke ngarkuar...' : `${reports.length} raporte`}
          </div>
          <ul className="flex-1 overflow-y-auto">
            {reports.map((r) => (
              <li key={r.id} className="border-b border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  onDoubleClick={() => router.push(`/reports/${r.id}`)}
                  className={`w-full px-3 py-3 text-left hover:bg-stone-50 ${
                    selectedId === r.id ? 'bg-stone-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorForCategory(r.categoryName) }}
                    />
                    <span>{r.status}</span>
                    {r.categoryName ? <span>· {r.categoryName}</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-900">{r.description}</p>
                  <Link
                    href={`/reports/${r.id}`}
                    className="mt-1 inline-block text-xs text-stone-600 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Hap detajet
                  </Link>
                </button>
              </li>
            ))}
          </ul>
          {!loading && reports.length === 0 ? (
            <p className="px-3 py-6 text-sm text-stone-600">Nuk ka raporte.</p>
          ) : null}
        </div>
      </div>

      {selected ? (
        <p className="mt-3 text-sm text-stone-500">
          I zgjedhur: {selected.description.slice(0, 80)}
          {selected.description.length > 80 ? '...' : ''} — hap detajet ose double-click.
        </p>
      ) : null}
    </main>
  );
}
