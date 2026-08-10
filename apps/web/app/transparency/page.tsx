'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TransparencyStats } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';

export default function TransparencyPage() {
  const [stats, setStats] = useState<TransparencyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<TransparencyStats>('/transparency');
        setStats(data);
      } catch {
        setError('Nuk u ngarkuan statistikat');
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Transparenca</h1>
      <p className="mt-2 text-stone-600">
        Statistika agregate publike për raportet e Prizren Smart City — pa të dhëna personale.
      </p>

      {error ? <p className="mt-6 text-red-600">{error}</p> : null}
      {!stats && !error ? <p className="mt-6 text-stone-500">Duke ngarkuar...</p> : null}

      {stats ? (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="Të zgjidhura" value={stats.resolved} />
            <Stat label="Të hapura" value={stats.pendingOpen} />
            <Stat
              label="Norma zgjidhje"
              value={stats.resolutionRate == null ? '—' : `${stats.resolutionRate}%`}
            />
          </section>

          <p className="mt-4 text-sm text-stone-600">
            Koha mesatare e zgjidhjes:{' '}
            {stats.avgResolutionHours == null ? '—' : `${stats.avgResolutionHours} orë`}
          </p>

          <section className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-medium text-stone-900">Sipas statusit</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.byStatus.map((row) => (
                  <li
                    key={row.status}
                    className="flex justify-between border-b border-stone-100 py-1.5"
                  >
                    <span className="text-stone-600">{row.status}</span>
                    <span className="tabular-nums font-medium text-stone-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-medium text-stone-900">Sipas kategorisë</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {stats.byCategory.length === 0 ? (
                  <li className="text-stone-500">Nuk ka të dhëna</li>
                ) : (
                  stats.byCategory.map((row) => (
                    <li
                      key={row.categoryId ?? row.category}
                      className="flex justify-between border-b border-stone-100 py-1.5"
                    >
                      <span className="text-stone-600">{row.category}</span>
                      <span className="tabular-nums font-medium text-stone-900">{row.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          <Link href="/reports" className="mt-10 inline-block text-sm text-stone-900 underline">
            Shiko raportet në hartë
          </Link>
        </>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
    </div>
  );
}
