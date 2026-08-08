'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { AIClassification, ReportDto, UpdateAiClassificationRequest } from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

const AI_CATEGORIES = [
  'road_damage',
  'lighting',
  'waste',
  'water',
  'public_space',
  'other',
] as const;
const AI_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [report, setReport] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AIClassification | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const canManageAi =
    user?.role === 'DEPARTMENT_ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!params.id) return;
    void (async () => {
      try {
        const data = await apiFetch<ReportDto>(`/reports/${params.id}`, { auth: true });
        setReport(data);
        setDraft(data.aiClassification);
      } catch {
        setError('Raporti nuk u gjet');
      }
    })();
  }, [params.id]);

  async function submitAi(action: 'accept' | 'edit') {
    if (!report) return;
    setAiBusy(true);
    setAiMessage(null);
    try {
      const body: UpdateAiClassificationRequest =
        action === 'accept'
          ? { action: 'accept' }
          : {
              action: 'edit',
              category: draft?.category,
              severity: draft?.severity,
              confidence: draft?.confidence ?? 1,
              summary: draft?.summary,
              recommendedDepartment: draft?.recommendedDepartment,
            };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/ai-classification`, {
        method: 'PATCH',
        auth: true,
        body,
      });
      setReport(updated);
      setDraft(updated.aiClassification);
      setEditing(false);
      setAiMessage(action === 'accept' ? 'Klasifikimi u pranua.' : 'Klasifikimi u perditsua.');
    } catch (err) {
      setAiMessage(err instanceof ApiError ? err.message : 'Veprimi AI deshtoi');
    } finally {
      setAiBusy(false);
    }
  }

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
        <p className="text-stone-600">Duke ngarkuar...</p>
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
        {report.aiNeedsReview ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">needs review</span>
        ) : null}
        {report.duplicateOfId ? (
          <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-900">possible duplicate</span>
        ) : null}
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

      {report.aiClassification ? (
        <section className="mt-8 rounded-md border border-stone-300 bg-stone-50 p-4">
          <h2 className="text-lg font-semibold text-stone-900">AI Classification</h2>
          {!editing ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-stone-500">Category</dt>
                <dd>{report.aiClassification.category}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Severity</dt>
                <dd>{report.aiClassification.severity}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Confidence</dt>
                <dd>{(report.aiClassification.confidence * 100).toFixed(0)}%</dd>
              </div>
              <div>
                <dt className="text-stone-500">Summary</dt>
                <dd>{report.aiClassification.summary}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Recommended department</dt>
                <dd>{report.aiClassification.recommendedDepartment}</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <label className="block">
                <span className="text-stone-600">Category</span>
                <select
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
                  value={draft?.category ?? 'other'}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, category: e.target.value as AIClassification['category'] }
                        : prev,
                    )
                  }
                >
                  {AI_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-stone-600">Severity</span>
                <select
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
                  value={draft?.severity ?? 'medium'}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, severity: e.target.value as AIClassification['severity'] }
                        : prev,
                    )
                  }
                >
                  {AI_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-stone-600">Summary</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
                  rows={3}
                  maxLength={300}
                  value={draft?.summary ?? ''}
                  onChange={(e) =>
                    setDraft((prev) => (prev ? { ...prev, summary: e.target.value } : prev))
                  }
                />
              </label>
              <label className="block">
                <span className="text-stone-600">Recommended department</span>
                <input
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5"
                  value={draft?.recommendedDepartment ?? ''}
                  onChange={(e) =>
                    setDraft((prev) =>
                      prev ? { ...prev, recommendedDepartment: e.target.value } : prev,
                    )
                  }
                />
              </label>
            </div>
          )}

          {canManageAi ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {!editing ? (
                <>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => void submitAi('accept')}
                    className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => {
                      setDraft(report.aiClassification);
                      setEditing(true);
                    }}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => void submitAi('edit')}
                    className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => {
                      setDraft(report.aiClassification);
                      setEditing(false);
                    }}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          ) : null}
          {aiMessage ? <p className="mt-3 text-sm text-stone-700">{aiMessage}</p> : null}
        </section>
      ) : (
        <p className="mt-8 text-sm text-stone-500">
          Nuk ka klasifikim AI ende (mungon celesi, ose AI deshtoi me fallback graceful).
        </p>
      )}
    </main>
  );
}
