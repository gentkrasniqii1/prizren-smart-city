'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CITIZEN_PIPELINE, type ReportStatus, type StatusHistoryDto } from '@prizren/shared-types';
import type { AppLocale } from '@/i18n/request';

function formatWhen(iso: string, locale: AppLocale) {
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL');
  } catch {
    return iso;
  }
}

export function ReportStatusTimeline({
  status,
  createdAt,
  updatedAt,
  history,
  hasAi,
  hasPhotoAfter,
}: {
  status: string;
  createdAt: string;
  updatedAt: string;
  history?: StatusHistoryDto[];
  hasAi?: boolean;
  hasPhotoAfter?: boolean;
}) {
  const t = useTranslations('ReportDetail');
  const locale = useLocale() as AppLocale;
  const rejected = status === 'REJECTED' || status === 'DUPLICATE';
  const waiting = status === 'WAITING_FOR_INFORMATION';
  const currentIndex = Math.max(
    0,
    CITIZEN_PIPELINE.indexOf(
      (status === 'IN_REVIEW'
        ? 'PENDING'
        : status === 'WAITING_FOR_INFORMATION'
          ? 'IN_PROGRESS'
          : status) as ReportStatus,
    ),
  );

  return (
    <section aria-labelledby="report-timeline-heading">
      <h2 id="report-timeline-heading" className="text-label text-foreground">
        {t('timelineTitle')}
      </h2>

      {rejected ? (
        <p className="mt-3 rounded-md bg-status-rejected px-3 py-2 text-sm text-status-rejected-foreground">
          {status === 'DUPLICATE' ? t('timelineDuplicate') : t('timelineRejected')}
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {CITIZEN_PIPELINE.map((step, i) => {
            const done = i < currentIndex || status === 'RESOLVED';
            const active = status !== 'RESOLVED' && i === currentIndex;
            const upcoming = !done && !active;
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                {i < CITIZEN_PIPELINE.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px',
                      done || active ? 'bg-mosque-400' : 'bg-border',
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-mosque-700 bg-card text-mosque-800 ring-2 ring-mosque-200',
                    upcoming && 'border-border bg-card text-muted-foreground',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      active
                        ? 'text-foreground'
                        : done
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                    )}
                  >
                    {t(`timeline.${step}`)}
                  </p>
                  {active ? (
                    <p className="mt-0.5 text-xs text-mosque-800">{t('timelineCurrent')}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {waiting ? (
        <p className="mt-3 rounded-md bg-status-waiting px-3 py-2 text-sm text-status-waiting-foreground">
          {t('timelineWaiting')}
        </p>
      ) : null}

      {history && history.length > 0 ? (
        <ol className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          {history.map((row) => (
            <li key={row.id}>
              <span className="font-medium text-foreground">{t(`timeline.${row.newStatus}`)}</span>
              {' · '}
              {formatWhen(row.changedAt, locale)}
              {row.note ? <span className="mt-0.5 block text-foreground">{row.note}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">{t('timelineReported')}</span>
            {' · '}
            {formatWhen(createdAt, locale)}
          </li>
          {updatedAt !== createdAt ? (
            <li>
              <span className="font-medium text-foreground">{t('timelineUpdated')}</span>
              {' · '}
              {formatWhen(updatedAt, locale)}
            </li>
          ) : null}
        </ul>
      )}

      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {hasAi ? <li>{t('timelineAi')}</li> : null}
        {hasPhotoAfter ? <li>{t('timelinePhotoAfter')}</li> : null}
      </ul>
    </section>
  );
}
