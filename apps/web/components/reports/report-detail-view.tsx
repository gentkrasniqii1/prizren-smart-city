'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bot, ExternalLink, FileDown, MapPin, ThumbsUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  AIClassification,
  CategoryDto,
  CommentDto,
  ModerateReportRequest,
  ModerationAction,
  PaginatedComments,
  ReportDto,
  RoutePreview,
  UpdateAiClassificationRequest,
  VoteCountResponse,
  WorkflowAction,
  WorkflowActionRequest,
} from '@prizren/shared-types';
import {
  PRE_APPROVAL_STATUSES,
  PUBLIC_REPORT_STATUSES,
  createCommentRequestSchema,
} from '@prizren/shared-types';
import { apiDownload, apiFetch } from '@/lib/api';
import { reportPublicPath } from '@/lib/report-path';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { useRealtimeRefresh } from '@/components/realtime-provider';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageContainer } from '@/components/layout/page-container';
import { RemoteImage } from '@/components/remote-image';
import { ReportStatusTimeline } from '@/components/reports/report-status-timeline';
import { Button, ErrorState, PriorityBadge, StatusBadge } from '@/components/ui';
import { MapSkeleton, ReportDetailSkeleton } from '@/components/ui/skeletons';
import { FieldError } from '@/components/ui/field-error';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';
import { AI_CATEGORIES, AI_SEVERITIES, getAiCategoryLabel, getAiSeverityLabel } from '@/lib/labels';
import { slaBucket, slaClass, slaLabel } from '@/lib/sla';
import type { AppLocale } from '@/i18n/request';
import { cn } from '@/lib/utils';

const LocationPickerMap = dynamic(
  () => import('@/components/location-picker-map').then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: function ReportLocationFallback() {
      return <MapSkeleton className="h-48 w-full rounded-md" />;
    },
  },
);

export function ReportDetailView() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('ReportDetail');
  const tCommon = useTranslations('Common');
  const locale = useLocale() as AppLocale;
  const { user } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const [report, setReport] = useState<ReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AIClassification | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [workflowNote, setWorkflowNote] = useState('');
  const [duplicateOfId, setDuplicateOfId] = useState('');
  const [voteBusy, setVoteBusy] = useState(false);
  const [related, setRelated] = useState<ReportDto[]>([]);
  const [aiPolling, setAiPolling] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [approveCategoryId, setApproveCategoryId] = useState('');
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const canManageAi = user?.role === 'DEPARTMENT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const canStaff =
    user?.role === 'DEPARTMENT_STAFF' ||
    user?.role === 'DEPARTMENT_ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  const loadReport = useCallback(async () => {
    if (!params.id) return;
    setError(null);
    try {
      const data = await apiFetch<ReportDto>(`/reports/${params.id}`, { auth: true });
      setReport(data);
      setDraft(data.aiClassification);
    } catch (err) {
      setError(errorMessage(err, t('notFound')));
    }
  }, [params.id, errorMessage, t]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useRealtimeRefresh(
    () => {
      if (!editing && !workflowBusy && !aiBusy) void loadReport();
    },
    Boolean(user && params.id),
    (event) => event.reportId === params.id,
  );

  const pendingReview = Boolean(report && PRE_APPROVAL_STATUSES.includes(report.status));

  useEffect(() => {
    if (!canStaff || !pendingReview) return;
    void apiFetch<CategoryDto[]>('/categories', { auth: true })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [canStaff, pendingReview, report?.id]);

  useEffect(() => {
    setApproveCategoryId(report?.categoryId ?? '');
  }, [report]);

  useEffect(() => {
    if (!canStaff || !pendingReview || !approveCategoryId) {
      setRoutePreview(null);
      return;
    }
    const query = new URLSearchParams({ categoryId: approveCategoryId });
    if (report?.priority) query.set('severity', report.priority);
    let cancelled = false;
    setPreviewBusy(true);
    void apiFetch<RoutePreview>(`/routing/preview?${query.toString()}`, { auth: true })
      .then((result) => {
        if (!cancelled) setRoutePreview(result);
      })
      .catch(() => {
        if (!cancelled) setRoutePreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [approveCategoryId, canStaff, pendingReview, report?.priority]);

  useEffect(() => {
    if (!params.id) return;
    void (async () => {
      try {
        const res = await apiFetch<PaginatedComments>(`/reports/${params.id}/comments?limit=50`, {
          auth: true,
        });
        setComments(res.data);
      } catch {
        // comments optional
      }
    })();
  }, [params.id]);

  // Poll while AI classification is still pending (post-submit job)
  useEffect(() => {
    if (!canStaff || !report || report.aiClassification) {
      setAiPolling(false);
      return;
    }
    setAiPolling(true);
    let attempts = 0;
    const reportId = report.id;
    const timer = window.setInterval(() => {
      void (async () => {
        attempts += 1;
        try {
          const data = await apiFetch<ReportDto>(`/reports/${reportId}`, { auth: true });
          if (data.aiClassification) {
            setReport(data);
            setDraft(data.aiClassification);
            setAiPolling(false);
            window.clearInterval(timer);
          }
        } catch {
          // keep polling until attempts exhausted
        }
        if (attempts >= 15) {
          setAiPolling(false);
          window.clearInterval(timer);
        }
      })();
    }, 2000);
    return () => {
      window.clearInterval(timer);
    };
    // Intentionally keyed on id + whether AI exists — not the full report object
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only while AI missing
  }, [canStaff, report?.id, report?.aiClassification]);

  useEffect(() => {
    if (!report) return;
    const lat = report.lat;
    const lng = report.lng;
    const id = report.id;
    void (async () => {
      try {
        const list = await apiFetch<ReportDto[]>(
          `/reports/nearby?lat=${lat}&lng=${lng}&radiusKm=0.8`,
        );
        setRelated(list.filter((r) => r.id !== id).slice(0, 5));
      } catch {
        setRelated([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload nearby when coords change
  }, [report?.id, report?.lat, report?.lng]);

  async function toggleVote() {
    if (!report || !user) {
      toast.push(t('loginToVote'), 'info');
      return;
    }
    setVoteBusy(true);
    try {
      const path = `/reports/${report.id}/votes`;
      const res = report.votedByMe
        ? await apiFetch<VoteCountResponse>(path, { method: 'DELETE', auth: true })
        : await apiFetch<VoteCountResponse>(path, { method: 'POST', auth: true });
      setReport((prev) =>
        prev ? { ...prev, voteCount: res.voteCount, votedByMe: res.votedByMe } : prev,
      );
    } catch (err) {
      toast.push(errorMessage(err, t('voteFailed')), 'error');
    } finally {
      setVoteBusy(false);
    }
  }

  async function submitAi(action: 'accept' | 'edit') {
    if (!report) return;
    setAiBusy(true);
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
      toast.push(action === 'accept' ? t('aiAccepted') : t('aiUpdated'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('aiFailed')), 'error');
    } finally {
      setAiBusy(false);
    }
  }

  async function uploadAfterPhoto(file: File | null) {
    if (!report || !file) return;
    setWorkflowBusy(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/photo-after`, {
        method: 'POST',
        auth: true,
        body: form,
      });
      setReport(updated);
      toast.push(t('afterUploaded'), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('afterFailed')), 'error');
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function downloadPdf() {
    if (!report) return;
    setPdfBusy(true);
    try {
      const blob = await apiDownload(`/reports/${report.id}/pdf`);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${report.publicId}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      toast.push(errorMessage(err, t('pdfFailed')), 'error');
    } finally {
      setPdfBusy(false);
    }
  }

  async function runWorkflow(action: WorkflowAction, note?: string) {
    if (!report) return;
    setWorkflowBusy(true);
    try {
      const body: WorkflowActionRequest = { action, note };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/workflow`, {
        method: 'POST',
        auth: true,
        body,
      });
      setReport(updated);
      toast.push(t(`workflowDone.${action}`), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('statusFailed')), 'error');
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function runModeration(action: ModerationAction) {
    if (!report) return;
    setWorkflowBusy(true);
    try {
      const body: ModerateReportRequest = {
        action,
        note: workflowNote.trim() || undefined,
        duplicateOfId: action === 'mark_duplicate' ? duplicateOfId.trim() || undefined : undefined,
        categoryId: action === 'approve' ? approveCategoryId || undefined : undefined,
      };
      const updated = await apiFetch<ReportDto>(`/reports/${report.id}/moderate`, {
        method: 'POST',
        auth: true,
        body,
      });
      setReport(updated);
      setWorkflowNote('');
      setDuplicateOfId('');
      toast.push(t(`moderationDone.${action}`), 'success');
    } catch (err) {
      toast.push(errorMessage(err, t('statusFailed')), 'error');
    } finally {
      setWorkflowBusy(false);
    }
  }

  if (error) {
    return (
      <main className="py-16">
        <PageContainer width="narrow">
          <ErrorState
            title={tCommon('errorTitle')}
            description={error}
            onRetry={() => void loadReport()}
            action={
              <Link href="/reports">
                <Button variant="secondary">{t('backToList')}</Button>
              </Link>
            }
          />
        </PageContainer>
      </main>
    );
  }

  if (!report) {
    return (
      <main>
        <ReportDetailSkeleton label={t('loading')} />
      </main>
    );
  }

  const bucket = slaBucket(report.dueAt);
  const initialPhotos = (report.media ?? []).filter((item) => item.role === 'INITIAL');
  const afterPhotos = (report.media ?? []).filter((item) => item.role === 'AFTER');
  const beforeUrls = initialPhotos.length
    ? initialPhotos.map((item) => item.url)
    : report.photoUrl
      ? [report.photoUrl]
      : [];
  const afterUrls = afterPhotos.length
    ? afterPhotos.map((item) => item.url)
    : report.photoAfterUrl
      ? [report.photoAfterUrl]
      : [];
  const canPdf = canStaff && PUBLIC_REPORT_STATUSES.includes(report.status);
  const mapUrl = `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=17/${report.lat}/${report.lng}`;
  const canApprove =
    Boolean(approveCategoryId) &&
    !previewBusy &&
    routePreview != null &&
    routePreview.source !== 'unrouted' &&
    Boolean(routePreview.departmentId || routePreview.institutionId);

  return (
    <main className="pb-bottom-nav pt-6 sm:pt-8">
      <PageContainer width="wide">
        <Breadcrumbs
          items={[
            { href: '/', label: t('crumbHome') },
            { href: '/reports', label: t('crumbReports') },
            { label: report.publicId },
          ]}
        />

        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-mosque-800"
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
              <Link
                href={`/reports/${report.duplicateOfId}`}
                className="inline-flex rounded-md bg-orange-200 px-2 py-0.5 text-[11px] font-semibold text-orange-950 hover:bg-orange-300"
              >
                {t('possibleDuplicate')}
              </Link>
            ) : null}
          </div>

          <h1 className="ds-page-title mt-3">{report.publicId}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.categoryName ?? t('title')}
            {report.departmentName ? ` · ${report.departmentName}` : ''}
            {report.institutionName ? ` · ${report.institutionName}` : ''}
          </p>
        </header>

        {PRE_APPROVAL_STATUSES.includes(report.status) ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {canStaff ? t('pendingStaffBanner') : t('pendingCitizenBanner')}
          </p>
        ) : null}

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)] lg:items-start">
          {/* Main column */}
          <div className="space-y-10">
            <section aria-labelledby="report-description-heading">
              <h2 id="report-description-heading" className="sr-only">
                {t('descriptionHeading')}
              </h2>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground sm:text-lg">
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
                {canPdf ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={pdfBusy}
                    onClick={() => void downloadPdf()}
                  >
                    <FileDown className="h-4 w-4" aria-hidden />
                    {pdfBusy ? t('pdfLoading') : t('downloadPdf')}
                  </Button>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="report-photos-heading">
              <h2 id="report-photos-heading" className="ds-section-title">
                {t('photosHeading')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <figure>
                  <figcaption className="text-caption uppercase tracking-wide text-muted-foreground">
                    {t('photoBefore')}
                  </figcaption>
                  {beforeUrls.length > 0 ? (
                    <ul className="mt-2 grid gap-2">
                      {beforeUrls.map((url, index) => (
                        <li key={url}>
                          <RemoteImage
                            src={url}
                            alt={t('photoBeforeAlt')}
                            className="max-h-80 w-full rounded-lg border border-border object-cover"
                          />
                          {beforeUrls.length > 1 ? (
                            <p className="mt-1 text-caption text-muted-foreground">
                              {index + 1}/{beforeUrls.length}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-border bg-muted px-3 py-10 text-center text-sm text-muted-foreground">
                      {t('noPhoto')}
                    </p>
                  )}
                </figure>
                <figure>
                  <figcaption className="text-caption uppercase tracking-wide text-muted-foreground">
                    {t('photoAfter')}
                  </figcaption>
                  {afterUrls.length > 0 ? (
                    <ul className="mt-2 grid gap-2">
                      {afterUrls.map((url) => (
                        <li key={url}>
                          <RemoteImage
                            src={url}
                            alt={t('photoAfterAlt')}
                            className="max-h-80 w-full rounded-lg border border-border object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-lg border border-dashed border-border bg-muted px-3 py-10 text-center text-sm text-muted-foreground">
                      {t('noPhotoAfter')}
                    </p>
                  )}
                </figure>
              </div>
            </section>

            <section
              aria-labelledby="report-comments-heading"
              className="border-t border-border pt-8"
            >
              <h2 id="report-comments-heading" className="ds-section-title">
                {t('commentsHeading')}
              </h2>
              <ul className="mt-4 space-y-4">
                {comments.length === 0 ? (
                  <li className="text-sm text-muted-foreground">{t('noComments')}</li>
                ) : (
                  comments.map((c) => (
                    <li key={c.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-semibold text-foreground">{c.authorName}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.text}</p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                      </p>
                    </li>
                  ))
                )}
              </ul>

              {user && report ? (
                <CommentComposer
                  reportId={report.id}
                  onCreated={(created) => setComments((prev) => [...prev, created])}
                />
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  <Link href="/login" className="font-medium text-mosque-800 underline">
                    {t('loginLink')}
                  </Link>{' '}
                  {t('loginToCommentSuffix')}
                </p>
              )}
            </section>

            {report.status === 'RESOLVED' ? (
              <section
                aria-labelledby="report-resolution-heading"
                className="rounded-xl border border-status-resolved bg-status-resolved/40 p-5"
              >
                <h2 id="report-resolution-heading" className="ds-card-title">
                  {t('resolutionHeading')}
                </h2>
                <p className="mt-2 text-sm text-foreground">{t('resolutionBody')}</p>
                {canStaff && report.latestNote ? (
                  <p className="mt-3 rounded-md bg-card px-3 py-2 text-sm text-foreground">
                    {report.latestNote}
                  </p>
                ) : null}
                {report.institutionName ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('resolutionBy', { name: report.institutionName })}
                  </p>
                ) : null}
              </section>
            ) : null}

            {canStaff && (report.allowedModerationActions?.length ?? 0) > 0 ? (
              <section
                aria-labelledby="report-moderation-heading"
                className="rounded-xl border border-amber-300 bg-amber-50/60 p-5"
              >
                <h2 id="report-moderation-heading" className="ds-card-title">
                  {t('moderationHeading')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('moderationIntro')}</p>
                <Label htmlFor="approve-category" className="mt-4">
                  {t('approveCategory')}
                </Label>
                <Select
                  id="approve-category"
                  value={approveCategoryId}
                  onChange={(e) => setApproveCategoryId(e.target.value)}
                >
                  <option value="">{t('approveCategoryPlaceholder')}</option>
                  {approveCategoryId &&
                  !categories.some((category) => category.id === approveCategoryId) ? (
                    <option value={approveCategoryId}>
                      {report.categoryName ?? approveCategoryId}
                    </option>
                  ) : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                {previewBusy ? (
                  <p className="mt-3 text-sm text-muted-foreground">{t('routingPreviewLoading')}</p>
                ) : null}
                {routePreview && !previewBusy ? (
                  <div className="mt-3 rounded-md border border-border bg-card px-3 py-3 text-sm">
                    <p className="font-medium text-foreground">{t('routingPreviewHeading')}</p>
                    <dl className="mt-2 grid gap-1 text-muted-foreground">
                      <div>
                        <dt className="inline">{t('routingPreviewInstitution')}: </dt>
                        <dd className="inline text-foreground">
                          {routePreview.institutionName ?? t('routingUnrouted')}
                          {routePreview.departmentName ? ` / ${routePreview.departmentName}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t('routingPreviewPriority')}: </dt>
                        <dd className="inline text-foreground">{routePreview.defaultPriority}</dd>
                      </div>
                      <div>
                        <dt className="inline">{t('routingPreviewSla')}: </dt>
                        <dd className="inline text-foreground">
                          {t('routingPreviewSlaHours', { hours: routePreview.slaHours })}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t('routingPreviewSource')}: </dt>
                        <dd className="inline text-foreground">
                          {t(`routingSource.${routePreview.source}`)}
                        </dd>
                      </div>
                    </dl>
                    {routePreview.source === 'unrouted' ||
                    (!routePreview.departmentId && !routePreview.institutionId) ? (
                      <p className="mt-2 text-sm text-destructive">{t('routingUnroutedHint')}</p>
                    ) : null}
                  </div>
                ) : null}
                {!approveCategoryId ? (
                  <p className="mt-3 text-sm text-muted-foreground">{t('approveNeedsCategory')}</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(report.allowedModerationActions ?? []).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant={action === 'approve' ? 'primary' : 'secondary'}
                      disabled={workflowBusy || (action === 'approve' && !canApprove)}
                      onClick={() => void runModeration(action)}
                    >
                      {t(`moderationActions.${action}`)}
                    </Button>
                  ))}
                </div>
                <Label htmlFor="moderation-note" className="mt-4">
                  {t('moderationNote')}
                </Label>
                <Textarea
                  id="moderation-note"
                  rows={2}
                  maxLength={500}
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                />
                {(report.allowedModerationActions ?? []).includes('mark_duplicate') ? (
                  <>
                    <Label htmlFor="duplicate-of" className="mt-4">
                      {t('duplicateOfLabel')}
                    </Label>
                    <Input
                      id="duplicate-of"
                      value={duplicateOfId}
                      onChange={(e) => setDuplicateOfId(e.target.value)}
                      placeholder={t('duplicateOfPlaceholder')}
                    />
                  </>
                ) : null}
              </section>
            ) : null}

            {canStaff && !PRE_APPROVAL_STATUSES.includes(report.status) ? (
              <section
                aria-labelledby="report-workflow-heading"
                className="rounded-xl border border-border bg-card p-5"
              >
                <h2 id="report-workflow-heading" className="ds-card-title">
                  {t('workflowHeading')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('workflowIntro')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(report.allowedActions ?? []).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant={
                        action === 'reject' || action === 'mark_duplicate' ? 'secondary' : 'primary'
                      }
                      disabled={workflowBusy || (action === 'resolve' && !report.photoAfterUrl)}
                      onClick={() => void runWorkflow(action, workflowNote.trim() || undefined)}
                    >
                      {t(`workflowActions.${action}`)}
                    </Button>
                  ))}
                </div>
                <Label htmlFor="workflow-note" className="mt-4">
                  {t('workflowNote')}
                </Label>
                <Textarea
                  id="workflow-note"
                  rows={2}
                  maxLength={500}
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                />
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
              </section>
            ) : null}

            {canStaff && report.aiClassification ? (
              <section
                aria-labelledby="report-ai-heading"
                className="rounded-xl border border-mosque-200 bg-mosque-50/50 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="report-ai-heading" className="ds-card-title">
                      {t('aiHeading')}
                    </h2>
                    {!editing ? (
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">{t('aiCategory')}</dt>
                          <dd className="font-medium text-foreground">
                            {getAiCategoryLabel(report.aiClassification.category, locale)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('aiSeverity')}</dt>
                          <dd className="font-medium text-foreground">
                            {getAiSeverityLabel(report.aiClassification.severity, locale)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('aiConfidence')}</dt>
                          <dd className="font-medium text-foreground">
                            {(report.aiClassification.confidence * 100).toFixed(0)}%
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('aiDepartment')}</dt>
                          <dd className="font-medium text-foreground">
                            {report.aiClassification.recommendedDepartment}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground">{t('aiSummary')}</dt>
                          <dd className="mt-0.5 text-foreground">
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
                                {getAiCategoryLabel(c, locale)}
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
                                {getAiSeverityLabel(s, locale)}
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
                  </div>
                </div>
              </section>
            ) : canStaff && aiPolling ? (
              <section
                aria-labelledby="report-ai-heading"
                className="rounded-xl border border-mosque-200 bg-mosque-50/50 p-5"
                aria-busy="true"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4 animate-pulse" aria-hidden />
                  </span>
                  <div>
                    <h2 id="report-ai-heading" className="ds-card-title">
                      {t('aiHeading')}
                    </h2>
                    <p className="mt-2 text-sm text-foreground" role="status">
                      {t('aiAnalyzing')}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">{t('aiMissing')}</p>
            )}

            <section aria-labelledby="report-related-heading">
              <h2 id="report-related-heading" className="ds-section-title">
                {t('relatedHeading')}
              </h2>
              {related.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t('relatedEmpty')}</p>
              ) : (
                <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={reportPublicPath(r)}
                        className="flex items-start gap-3 px-4 py-3 transition hover:bg-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge status={r.status} />
                            {r.priority ? <PriorityBadge priority={r.priority} /> : null}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                            {r.description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.publicId}
                            {r.categoryName ? ` · ${r.categoryName}` : ` · ${t('relatedNearby')}`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-xl border border-border bg-card p-5">
              <ReportStatusTimeline
                status={report.status}
                createdAt={report.createdAt}
                updatedAt={report.updatedAt}
                history={report.history}
                hasAi={canStaff && Boolean(report.aiClassification)}
                hasPhotoAfter={Boolean(report.photoAfterUrl) || afterUrls.length > 0}
                showNotes={
                  canStaff || Boolean(user?.id && report.userId && user.id === report.userId)
                }
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-label text-foreground">{t('metaHeading')}</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('location')}</dt>
                  <dd className="mt-0.5 text-foreground">
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
                          <span className="mt-0.5 block text-xs text-muted-foreground">
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
                  <dt className="text-muted-foreground">{t('institution')}</dt>
                  <dd className="mt-0.5 text-foreground">
                    {report.institutionName ?? report.departmentName ?? t('institutionUnknown')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('created')}</dt>
                  <dd className="mt-0.5 text-foreground">
                    {new Date(report.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                  </dd>
                </div>
                {report.dueAt ? (
                  <div>
                    <dt className="text-muted-foreground">{t('dueAt')}</dt>
                    <dd className="mt-0.5 text-foreground">
                      {new Date(report.dueAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 overflow-hidden rounded-md border border-border">
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

function CommentComposer({
  reportId,
  onCreated,
}: {
  reportId: string;
  onCreated: (comment: CommentDto) => void;
}) {
  const t = useTranslations('ReportDetail');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ text: string }>({
    resolver: zodResolver(createCommentRequestSchema),
    defaultValues: { text: '' },
  });

  async function onValid(values: { text: string }) {
    try {
      const created = await apiFetch<CommentDto>(`/reports/${reportId}/comments`, {
        method: 'POST',
        auth: true,
        body: { text: values.text },
      });
      onCreated(created);
      reset({ text: '' });
    } catch (err) {
      toast.push(errorMessage(err, t('commentFailed')), 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="mt-5 space-y-2" noValidate>
      <Label htmlFor="report-comment">{t('commentLabel')}</Label>
      <Textarea
        id="report-comment"
        rows={3}
        maxLength={2000}
        placeholder={t('commentPlaceholder')}
        invalid={Boolean(errors.text)}
        aria-describedby={errors.text ? 'report-comment-error' : undefined}
        {...register('text')}
      />
      <FieldError id="report-comment-error" message={issueMessage(errors.text, t)} />
      <Button type="submit" size="sm" loading={isSubmitting}>
        {t('commentSubmit')}
      </Button>
    </form>
  );
}
