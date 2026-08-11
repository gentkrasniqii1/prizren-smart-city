'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ReportStatusKey } from '@/lib/labels';

const PIPELINE: ReportStatusKey[] = ['PENDING', 'IN_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

function pipelineIndex(status: string): number {
  if (status === 'REJECTED') return -1;
  const i = PIPELINE.indexOf(status as ReportStatusKey);
  return i >= 0 ? i : 0;
}

export function ReportStatusTimeline({
  status,
  createdAt,
  updatedAt,
  hasAi,
  hasPhotoAfter,
}: {
  status: string;
  createdAt: string;
  updatedAt: string;
  hasAi?: boolean;
  hasPhotoAfter?: boolean;
}) {
  const t = useTranslations('ReportDetail');
  const rejected = status === 'REJECTED';
  const current = pipelineIndex(status);

  return (
    <section aria-labelledby="report-timeline-heading">
      <h2 id="report-timeline-heading" className="text-label text-stone-700">
        {t('timelineTitle')}
      </h2>

      {rejected ? (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
          {t('timelineRejected')}
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {PIPELINE.map((step, i) => {
            const done = i < current;
            const active = i === current;
            const upcoming = i > current;
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                {i < PIPELINE.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px',
                      done || active ? 'bg-mosque-400' : 'bg-stone-200',
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                    done && 'border-mosque-700 bg-mosque-700 text-white',
                    active && 'border-mosque-700 bg-white text-mosque-800 ring-2 ring-mosque-200',
                    upcoming && 'border-stone-300 bg-white text-stone-400',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-stone-950' : done ? 'text-stone-800' : 'text-stone-400',
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

      <ul className="mt-5 space-y-2 border-t border-stone-100 pt-4 text-xs text-stone-600">
        <li>
          <span className="font-medium text-stone-800">{t('timelineReported')}</span>
          {' · '}
          {formatWhen(createdAt)}
        </li>
        {updatedAt !== createdAt ? (
          <li>
            <span className="font-medium text-stone-800">{t('timelineUpdated')}</span>
            {' · '}
            {formatWhen(updatedAt)}
          </li>
        ) : null}
        {hasAi ? <li>{t('timelineAi')}</li> : null}
        {hasPhotoAfter ? <li>{t('timelinePhotoAfter')}</li> : null}
      </ul>
    </section>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
