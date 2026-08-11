'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bot, ExternalLink, MapPin, ThumbsUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { RemoteImage } from '@/components/remote-image';
import { ReportStatusTimeline } from '@/components/reports/report-status-timeline';
import { Button, PriorityBadge, Skeleton, Spinner, StatusBadge } from '@/components/ui';
import { FieldError } from '@/components/ui/field-error';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import type { AppLocale } from '@/i18n/request';
import { cn } from '@/lib/utils';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function MapLoading() {
      return <Skeleton className="h-48 w-full rounded-md" />;
    },
  },
);

const AI_CATEGORIES = [
  'road_damage',
  'lighting',
  'waste',
  'water',
  'public_space',
  'other',
] as const;
const AI_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export function ReportDetailView() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('ReportDetail');
  const locale = useLocale() as AppLocale;
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
  const [commentError, setCommentError] = useState<string | null>(null);
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
        setError(t('notFound'));
      }
    })();
  }, [params.id, t]);

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
      setCitizenMessage(t('loginToVote'));
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
      setCitizenMessage(err instanceof ApiError ? err.message : t('voteFailed'));
    } finally {
      setVoteBusy(false);
    }
  }

  async function submitComment() {
    if (!report || !user) {
      setCitizenMessage(t('loginToComment'));
      return;
    }
    const text = commentText.trim();
    if (!text) {
      setCommentError(t('commentRequired'));
      return;
    }
    setCitizenMessage(null);
    setCommentError(null);
    try {
      const created = await apiFetch<CommentDto>(`/reports/${report.id}/comments`, {
        method: 'POST',
        auth: true,
        body: { text },
      });
      setComments((prev) => [...prev, created]);
      setCommentText('');
    } catch (err) {
      setCitizenMessage(err instanceof ApiError ? err.message : t('commentFailed'));
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
      setAiMessage(action === 'accept' ? t('aiAccepted') : t('aiUpdated'));
    } catch (err) {
      setAiMessage(err instanceof ApiError ? err.message : t('aiFailed'));
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
      setWorkflowMessage(t('afterUploaded'));
    } catch (err) {
      setWorkflowMessage(err instanceof ApiError ? err.message : t('afterFailed'));
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
      setWorkflowMessage(t('markedResolved'));
    } catch (err) {
      setWorkflowMessage(err instanceof ApiError ? err.message : t('statusFailed'));
    } finally {
      setWorkflowBusy(false);
    }
  }

  if (error) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <p className="text-red-700" role="alert">
            {error}
          </p>
          <Link
            href="/reports"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-mosque-800 underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('backToList')}
          </Link>
        </PageContainer>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="py-16">
        <PageContainer width="wide">
          <Spinner label={t('loading')} />
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-3/4 max-w-md" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </PageContainer>
      </main>
    );
  }

  const bucket = slaBucket(report.dueAt);
  const shortId = report.id.slice(0, 8);
  const mapUrl = `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=17/${report.lat}/${report.lng}`;

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs
          items={[
            { href: '/', label: t('crumbHome') },
            { href: '/reports', label: t('crumbReports') },
            { label: shortId },
          ]}
        />

        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-stone-600 transition hover:text-mosque-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t('backToList')}
        </Link>

        <header className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            {report.priority ? <PriorityBadge priority={report.priority} /> : null}
            {bucket ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                  slaClass(bucket),
                )}
              >
                {slaLabel(bucket, locale)}
              </span>
            ) : null}
            {report.aiNeedsReview ? (
              <span className="inline-flex rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                {t('needsReview')}
              </span>
            ) : null}
            {report.duplicateOfId ? (
              <span className="inline-flex rounded-md bg-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-950">
                {t('possibleDuplicate')}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 font-display text-h1 tracking-tight text-stone-950 sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {t('idLabel', { id: shortId })}
            {report.categoryName ? ` · ${report.categoryName}` : ''}
            {report.departmentName ? ` · ${report.departmentName}` : ''}
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)] lg:items-start">
          {/* Main column */}
          <div className="space-y-10">
            <section aria-labelledby="report-description-heading">
              <h2 id="report-description-heading" className="sr-only">
                {t('descriptionHeading')}
              </h2>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-stone-800 sm:text-lg">
                {report.description}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={report.votedByMe ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={voteBusy}
                  onClick={() => void toggleVote()}
                >
                  <ThumbsUp className="h-4 w-4" aria-hidden />
                  {report.votedByMe ? t('unvote') : t('vote')} · {report.voteCount ?? 0}
                </Button>
                {citizenMessage ? (
                  <p className="text-sm text-stone-600" role="status">
                    {citizenMessage}
                  </p>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="report-photos-heading">
              <h2
                id="report-photos-heading"
                className="font-display text-xl tracking-tight text-stone-950"
              >
                {t('photosHeading')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <figure>
                  <figcaption className="text-caption uppercase tracking-wide text-stone-500">
                    {t('photoBefore')}
                  </figcaption>
                  {report.photoUrl ? (
                    <RemoteImage
                      src={report.photoUrl}
                      alt={t('photoBeforeAlt')}
                      className="mt-2 max-h-80 w-full rounded-lg border border-stone-200 object-cover"
                    />
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-10 text-center text-sm text-stone-500">
                      {t('noPhoto')}
                    </p>
                  )}
                </figure>
                <figure>
                  <figcaption className="text-caption uppercase tracking-wide text-stone-500">
                    {t('photoAfter')}
                  </figcaption>
                  {report.photoAfterUrl ? (
                    <RemoteImage
                      src={report.photoAfterUrl}
                      alt={t('photoAfterAlt')}
                      className="mt-2 max-h-80 w-full rounded-lg border border-stone-200 object-cover"
                    />
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-10 text-center text-sm text-stone-500">
                      {t('noPhotoAfter')}
                    </p>
                  )}
                </figure>
              </div>
            </section>

            <section
              aria-labelledby="report-comments-heading"
              className="border-t border-stone-200 pt-8"
            >
              <h2
                id="report-comments-heading"
                className="font-display text-xl tracking-tight text-stone-950"
              >
                {t('commentsHeading')}
              </h2>
              <ul className="mt-4 space-y-4">
                {comments.length === 0 ? (
                  <li className="text-sm text-stone-500">{t('noComments')}</li>
                ) : (
                  comments.map((c) => (
                    <li
                      key={c.id}
                      className="border-b border-stone-100 pb-4 last:border-0 last:pb-0"
                    >
                      <p className="text-sm font-semibold text-stone-900">{c.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{c.text}</p>
                      <p className="mt-1.5 text-xs text-stone-500">
                        {new Date(c.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                      </p>
                    </li>
                  ))
                )}
              </ul>

              {user ? (
                <div className="mt-5 space-y-2">
                  <Label htmlFor="report-comment">{t('commentLabel')}</Label>
                  <Textarea
                    id="report-comment"
                    rows={3}
                    maxLength={2000}
                    placeholder={t('commentPlaceholder')}
                    value={commentText}
                    invalid={Boolean(commentError)}
                    onChange={(e) => {
                      setCommentText(e.target.value);
                      setCommentError(null);
                    }}
                  />
                  <FieldError message={commentError ?? undefined} />
                  <Button type="button" size="sm" onClick={() => void submitComment()}>
                    {t('commentSubmit')}
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-stone-600">
                  <Link href="/login" className="font-medium text-mosque-800 underline">
                    {t('loginLink')}
                  </Link>{' '}
                  {t('loginToCommentSuffix')}
                </p>
              )}
            </section>

            {canStaff ? (
              <section
                aria-labelledby="report-workflow-heading"
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <h2
                  id="report-workflow-heading"
                  className="font-display text-lg tracking-tight text-stone-950"
                >
                  {t('workflowHeading')}
                </h2>
                <p className="mt-1 text-sm text-stone-600">{t('workflowIntro')}</p>
                <Label htmlFor="photo-after" className="mt-4">
                  {t('afterUploadLabel')}
                </Label>
                <Input
                  id="photo-after"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={workflowBusy}
                  onChange={(e) => void uploadAfterPhoto(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={workflowBusy || report.status === 'RESOLVED'}
                  onClick={() => void markResolved()}
                  className="mt-4"
                >
                  {t('markResolved')}
                </Button>
                {workflowMessage ? (
                  <p className="mt-3 text-sm text-stone-700" role="status">
                    {workflowMessage}
                  </p>
                ) : null}
              </section>
            ) : null}

            {report.aiClassification ? (
              <section
                aria-labelledby="report-ai-heading"
                className="rounded-xl border border-mosque-200 bg-mosque-50/50 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mosque-700 text-white">
                    <Bot className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      id="report-ai-heading"
                      className="font-display text-lg tracking-tight text-stone-950"
                    >
                      {t('aiHeading')}
                    </h2>
                    {!editing ? (
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-stone-500">{t('aiCategory')}</dt>
                          <dd className="font-medium text-stone-900">
                            {report.aiClassification.category}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t('aiSeverity')}</dt>
                          <dd className="font-medium text-stone-900">
                            {report.aiClassification.severity}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t('aiConfidence')}</dt>
                          <dd className="font-medium text-stone-900">
                            {(report.aiClassification.confidence * 100).toFixed(0)}%
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">{t('aiDepartment')}</dt>
                          <dd className="font-medium text-stone-900">
                            {report.aiClassification.recommendedDepartment}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-stone-500">{t('aiSummary')}</dt>
                          <dd className="mt-0.5 text-stone-800">
                            {report.aiClassification.summary}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <Label htmlFor="ai-category">{t('aiCategory')}</Label>
                          <Select
                            id="ai-category"
                            value={draft?.category ?? 'other'}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      category: e.target.value as AIClassification['category'],
                                    }
                                  : prev,
                              )
                            }
                          >
                            {AI_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="ai-severity">{t('aiSeverity')}</Label>
                          <Select
                            id="ai-severity"
                            value={draft?.severity ?? 'medium'}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      severity: e.target.value as AIClassification['severity'],
                                    }
                                  : prev,
                              )
                            }
                          >
                            {AI_SEVERITIES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="ai-summary">{t('aiSummary')}</Label>
                          <Textarea
                            id="ai-summary"
                            rows={3}
                            maxLength={300}
                            value={draft?.summary ?? ''}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev ? { ...prev, summary: e.target.value } : prev,
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="ai-dept">{t('aiDepartment')}</Label>
                          <Input
                            id="ai-dept"
                            value={draft?.recommendedDepartment ?? ''}
                            onChange={(e) =>
                              setDraft((prev) =>
                                prev ? { ...prev, recommendedDepartment: e.target.value } : prev,
                              )
                            }
                          />
                        </div>
                      </div>
                    )}

                    {canManageAi ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!editing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={aiBusy}
                              onClick={() => void submitAi('accept')}
                            >
                              {t('aiAccept')}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={aiBusy}
                              onClick={() => {
                                setDraft(report.aiClassification);
                                setEditing(true);
                              }}
                            >
                              {t('aiEdit')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={aiBusy}
                              onClick={() => void submitAi('edit')}
                            >
                              {t('aiSave')}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={aiBusy}
                              onClick={() => {
                                setDraft(report.aiClassification);
                                setEditing(false);
                              }}
                            >
                              {t('aiCancel')}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                    {aiMessage ? (
                      <p className="mt-3 text-sm text-stone-700" role="status">
                        {aiMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <p className="text-sm text-stone-500">{t('aiMissing')}</p>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <ReportStatusTimeline
                status={report.status}
                createdAt={report.createdAt}
                updatedAt={report.updatedAt}
                hasAi={Boolean(report.aiClassification)}
                hasPhotoAfter={Boolean(report.photoAfterUrl)}
              />
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-label text-stone-700">{t('metaHeading')}</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-stone-500">{t('location')}</dt>
                  <dd className="mt-0.5 text-stone-900">
                    <span className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-mosque-700" aria-hidden />
                      <span>
                        {report.address
                          ? report.address
                          : t('coords', {
                              lat: report.lat.toFixed(5),
                              lng: report.lng.toFixed(5),
                            })}
                        {report.address ? (
                          <span className="mt-0.5 block text-xs text-stone-500">
                            {t('coords', {
                              lat: report.lat.toFixed(5),
                              lng: report.lng.toFixed(5),
                            })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">{t('created')}</dt>
                  <dd className="mt-0.5 text-stone-900">
                    {new Date(report.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                  </dd>
                </div>
                {report.dueAt ? (
                  <div>
                    <dt className="text-stone-500">{t('dueAt')}</dt>
                    <dd className="mt-0.5 text-stone-900">
                      {new Date(report.dueAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 overflow-hidden rounded-md border border-stone-200">
                <LocationPickerMap
                  lat={report.lat}
                  lng={report.lng}
                  interactive={false}
                  onPick={() => undefined}
                />
              </div>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mosque-800 hover:underline"
              >
                {t('openMap')}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </aside>
        </div>
      </PageContainer>
    </main>
  );
}
