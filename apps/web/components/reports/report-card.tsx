'use client';

import Link from 'next/link';
import { MapPin, ThumbsUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReportDto } from '@prizren/shared-types';
import { RemoteImage } from '@/components/remote-image';
import { PriorityBadge, StatusBadge } from '@/components/ui/badge';
import { colorForCategory } from '@/components/reports-map';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/request';

function excerpt(text: string, max = 96) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

export function ReportCard({
  report,
  selected,
  onSelect,
  compact = false,
}: {
  report: ReportDto;
  selected?: boolean;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const t = useTranslations('Reports');
  const locale = useLocale() as AppLocale;

  const body = (
    <>
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-muted',
          compact ? 'h-16 w-16 rounded-md' : 'aspect-[16/10] w-full',
        )}
      >
        {report.photoUrl ? (
          <RemoteImage
            src={report.photoUrl}
            alt=""
            className="h-full w-full object-cover"
            sizes={compact ? '64px' : '(max-width: 768px) 100vw, 360px'}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            {t('noPhoto')}
          </div>
        )}
      </div>

      <div className={cn('min-w-0 flex-1', !compact && 'p-3')}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: colorForCategory(report.categoryName) }}
            aria-hidden
          />
          <StatusBadge status={report.status} />
          {report.priority ? <PriorityBadge priority={report.priority} /> : null}
        </div>
        <p
          className={cn(
            'mt-1.5 font-medium text-foreground',
            compact ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-sm',
          )}
        >
          {excerpt(report.description, compact ? 80 : 120)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {report.categoryName ? <span>{report.categoryName}</span> : null}
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            {report.address ? report.address : `${report.lat.toFixed(3)}, ${report.lng.toFixed(3)}`}
          </span>
          <span>
            {new Date(report.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'sq-AL')}
          </span>
          {typeof report.voteCount === 'number' ? (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" aria-hidden />
              {report.voteCount}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  const className = cn(
    'w-full border-b border-border text-left transition duration-fast ease-product',
    selected ? 'bg-mosque-50 dark:bg-mosque-900/30' : 'bg-card hover:bg-muted/60',
    compact ? 'flex gap-3 p-3' : 'block',
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(report.id)}
        className={className}
        aria-pressed={selected}
      >
        {compact ? body : <div className="flex flex-col">{body}</div>}
      </button>
    );
  }

  return (
    <Link href={`/reports/${report.id}`} className={cn(className, 'block')}>
      {compact ? <div className="flex gap-3">{body}</div> : body}
    </Link>
  );
}
