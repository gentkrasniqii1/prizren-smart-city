'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  AIClassification,
  CommentDto,
  PaginatedComments,
  ReportDto,
  UpdateAiClassificationRequest,
  UpdateReportStatusRequest,
  VoteCountResponse,
} from '@prizren/shared-types';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { RemoteImage } from '@/components/remote-image';
import { PriorityBadge, Skeleton, Spinner, StatusBadge } from '@/components/ui';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';

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
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [commentText, setCommentText] = useState('');
  const [voteBusy, setVoteBusy] = useState(false);
  const [citizenMessage, setCitizenMessage] = useState<string | null>(null);

  const canManageAi = user?.role === 'DEPARTMENT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const canStaff =
    user?.role === 'DEPARTMENT_STAFF' ||
    user?.role === 'DEPARTMENT_ADMIN' ||
    user?.role === 'SUPER_ADMIN';

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

  useEffect(() => {
    if (!params.id) return;
    void (async () => {
      try {
        const res = await apiFetch<PaginatedComments>(`/reports/${params.id}/comments?limit=50`);
        setComments(res.data);
      } catch {
        // comments optional
      }
    })();
  }, [params.id]);

  async function toggleVote() {
    if (!report || !user) {
      setCitizenMessage('Duhet të hysh për të votuar.');
      return;
    }
    setVoteBusy(true);
    setCitizenMessage(null);
    try {
      const path = `/reports/${report.id}/votes`;
      const res = report.votedByMe
        ? await apiFetch<VoteCountResponse>(path, { method: 'DELETE', auth: true })
        : await apiFetch<VoteCountResponse>(path, { method: 'POST', auth: true });
      setReport((prev) =>
        prev ? { ...prev, voteCount: res.voteCount, votedByMe: res.votedByMe } : prev,
      );
    } catch (err) {
      setCitizenMessage(err instanceof ApiError ? err.message : 'Votimi deshtoi');
    } finally {
      setVoteBusy(false);
    }
  }

  async function submitComment() {
    if (!report || !user) {
      setCitizenMessage('Duhet të hysh për të komentuar.');
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    setCitizenMessage(null);
    try {
      const created = await apiFetch<CommentDto>(`/reports/${report.id}/comments`, {
        method: 'POST',
        auth: true,
        body: { text },
      });
      setComments((prev) => [...prev, created]);
      setCommentText('');
    } catch (err) {
      setCitizenMessage(err instanceof ApiError ? err.message : 'Komenti deshtoi');
    }
  }

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

  async function uploadAfterPhoto(file: File | null) {
    if (!report || !file) return;
    setWorkflowBusy(true);
    setWorkflowMessage(null);
    try {
      const form = new FormData();
      form.append('photo', file);
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/photo-after`, {
        method: 'POST',
        auth: true,
        body: form,
      });
      setReport(updated);
      setWorkflowMessage('Fotoja after u ngarkua.');
    } catch (err) {
      setWorkflowMessage(err instanceof ApiError ? err.message : 'Ngarkimi after deshtoi');
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function markResolved() {
    if (!report) return;
    setWorkflowBusy(true);
    setWorkflowMessage(null);
    try {
      const body: UpdateReportStatusRequest = { status: 'RESOLVED' };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/status`, {
        method: 'PATCH',
        auth: true,
        body,
      });
      setReport(updated);
      setWorkflowMessage('Raporti u shenua si RESOLVED.');
    } catch (err) {
      setWorkflowMessage(err instanceof ApiError ? err.message : 'Ndryshimi i statusit deshtoi');
    } finally {
      setWorkflowBusy(false);
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
        <Spinner />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-3/4 max-w-md" />
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  const bucket = slaBucket(report.dueAt);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <Link href="/reports" className="text-sm text-stone-600 hover:text-stone-900">
        ← Kthehu
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
        <StatusBadge status={report.status} />
        {report.categoryName ? <span>{report.categoryName}</span> : null}
        {report.priority ? <PriorityBadge priority={report.priority} /> : null}
        {bucket ? (
          <span className={`rounded px-2 py-0.5 font-semibold ${slaClass(bucket)}`}>
            {slaLabel(bucket)}
          </span>
        ) : null}
        {report.aiNeedsReview ? (
          <span className="rounded bg-amber-200 px-2 py-0.5 font-semibold text-amber-950">
            needs review
          </span>
        ) : null}
        {report.duplicateOfId ? (
          <span className="rounded bg-orange-200 px-2 py-0.5 font-semibold text-orange-950">
            possible duplicate
          </span>
        ) : null}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
        Detajet e raportit
      </h1>
      <p className="mt-4 whitespace-pre-wrap text-stone-800">{report.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={voteBusy}
          onClick={() => void toggleVote()}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60"
        >
          {report.votedByMe ? 'Hiq votën' : 'Voto'} · {report.voteCount ?? 0}
        </button>
        {citizenMessage ? <p className="text-sm text-stone-600">{citizenMessage}</p> : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Before</p>
          {report.photoUrl ? (
            <RemoteImage
              src={report.photoUrl}
              alt="Foto e problemit para zgjidhjes"
              className="mt-2 max-h-72 w-full rounded-md border object-cover"
            />
          ) : (
            <p className="mt-2 text-sm text-stone-500">Nuk ka foto</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">After</p>
          {report.photoAfterUrl ? (
            <RemoteImage
              src={report.photoAfterUrl}
              alt="Foto e problemit pas zgjidhjes"
              className="mt-2 max-h-72 w-full rounded-md border object-cover"
            />
          ) : (
            <p className="mt-2 text-sm text-stone-500">Nuk ka foto after ende</p>
          )}
        </div>
      </div>

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
        {report.dueAt ? (
          <div>
            <dt className="text-stone-500">Afati SLA (dueAt)</dt>
            <dd>{new Date(report.dueAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      <section className="mt-8 border-t border-stone-200 pt-6">
        <h2 className="text-lg font-semibold text-stone-900">Komente</h2>
        <ul className="mt-3 space-y-3">
          {comments.length === 0 ? (
            <li className="text-sm text-stone-500">Ende pa komente.</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="font-medium text-stone-800">{c.authorName}</p>
                <p className="whitespace-pre-wrap text-stone-700">{c.text}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
        {user ? (
          <div className="mt-4 space-y-2">
            <label htmlFor="report-comment" className="block text-sm text-stone-700">
              Komenti yt
            </label>
            <textarea
              id="report-comment"
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              rows={3}
              maxLength={2000}
              placeholder="Shkruaj një koment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void submitComment()}
              className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white"
            >
              Dërgo komentin
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-600">
            <Link href="/login" className="underline">
              Hyr
            </Link>{' '}
            për të komentuar.
          </p>
        )}
      </section>

      {canStaff ? (
        <section className="mt-8 rounded-md border border-stone-300 bg-white p-4">
          <h2 className="text-lg font-semibold text-stone-900">Workflow departamenti</h2>
          <p className="mt-1 text-sm text-stone-600">
            Ngarko foton after, pastaj sheno si RESOLVED. Resolve kerkon photoAfter.
          </p>
          <label className="mt-4 block text-sm">
            <span className="text-stone-600">Foto after</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={workflowBusy}
              className="mt-1 block w-full text-sm"
              onChange={(e) => void uploadAfterPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={workflowBusy || report.status === 'RESOLVED'}
            onClick={() => void markResolved()}
            className="mt-4 rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Shenoe RESOLVED
          </button>
          {workflowMessage ? (
            <p className="mt-3 text-sm text-stone-700">{workflowMessage}</p>
          ) : null}
        </section>
      ) : null}

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
