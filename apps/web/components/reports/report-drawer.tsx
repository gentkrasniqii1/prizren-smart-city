'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ExternalLink, MapPin, ThumbsUp, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReportDto } from '@prizren/shared-types';
import { RemoteImage } from '@/components/remote-image';
import { Button } from '@/components/ui/button';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/request';
import { reportPublicPath } from '@/lib/report-path';
import { cn } from '@/lib/utils';

export function ReportDrawer({
  report,
  onClose,
  className,
  modal = false,
  hideClose = false,
}: {
  report: ReportDto;
  onClose: () => void;
  className?: string;
  /** When true (mobile overlay), expose dialog semantics and focus the close control. */
  modal?: boolean;
  /** Hide close when parent Sheet already provides one. */
  hideClose?: boolean;
}) {
  const t = useTranslations('Reports');
  const locale = useLocale() as AppLocale;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modal || hideClose) return;
    closeRef.current?.focus();
  }, [modal, hideClose, report.id]);

  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-hidden border-border bg-card text-card-foreground shadow-lift',
        className,
      )}
      aria-label={t('drawerLabel')}
      role={modal ? 'dialog' : undefined}
      aria-modal={modal ? true : undefined}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wide text-mosque-700">
            {report.publicId}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={report.status} />
            {report.priority ? <PriorityBadge priority={report.priority} /> : null}
          </div>
        </div>
        {!hideClose ? (
          <Button
            ref={closeRef}
            type="button"
            variant="icon"
            size="sm"
            onClick={onClose}
            aria-label={t('closeDrawer')}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-[16/10] bg-muted">
          {report.photoUrl ? (
            <RemoteImage
              src={report.photoUrl}
              alt=""
              className="h-full w-full object-cover"
              sizes="400px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('noPhoto')}
            </div>
          )}
        </div>

        <div className="space-y-4 p-4">
          {report.categoryName ? (
            <p className="text-sm font-medium text-mosque-800">{report.categoryName}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {report.description}
          </p>

          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="sr-only">{t('location')}</dt>
              <dd className="inline-flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {report.address
                    ? report.address
                    : `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>{t('reportedAt')}</dt>
              <dd>
                {new Date(report.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}
              </dd>
            </div>
            {typeof report.voteCount === 'number' ? (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  {t('votes')}
                </dt>
                <dd>{report.voteCount}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <Link href={reportPublicPath(report)} className="block">
          <Button className="w-full" size="sm">
            {t('openDetails')}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </aside>
  );
}
