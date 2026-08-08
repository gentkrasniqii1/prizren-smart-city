'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ReportDto } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    void (async () => {
      try {
        const data = await apiFetch<ReportDto>(`/reports/${params.id}`, { auth: true });
        setReport(data);
      } catch {
        setError('Raporti nuk u gjet');
      }
    })();
  }, [params.id]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-red-600">{error}</p>
        <Link href="/reports" className="mt-4 inline-block text-stone-900 underline">
          Kthehu te lista
        </Link>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-stone-600">Duke ngarkuar…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/reports" className="text-sm text-stone-600 hover:text-stone-900">
        ← Kthehu
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
        <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">{report.status}</span>
        {report.categoryName ? <span>{report.categoryName}</span> : null}
        {report.priority ? <span>{report.priority}</span> : null}
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">Detajet e raportit</h1>
      <p className="mt-4 whitespace-pre-wrap text-stone-800">{report.description}</p>

      {report.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.photoUrl}
          alt="Foto e raportit"
          className="mt-6 max-h-96 w-full rounded-md border object-cover"
        />
      ) : null}

      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="text-stone-500">Lokacioni</dt>
          <dd>
            {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            {report.address ? ` · ${report.address}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Krijuar</dt>
          <dd>{new Date(report.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
    </main>
  );
}
