'use client';

import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { NotificationDto } from '@prizren/shared-types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/request';

function relativeTime(iso: string, locale: AppLocale): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'sq', { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  return rtf.format(-days, 'day');
}

export function NotificationItem({
  notification,
  onMarkRead,
  busy,
  compact = false,
}: {
  notification: NotificationDto;
  onMarkRead?: (id: string) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations('Notifications');
  const locale = useLocale() as AppLocale;
  const unread = !notification.read;

  return (
    <li
      className={cn('flex gap-3 px-4 py-3.5', unread && 'bg-mosque-50/50', compact && 'px-3 py-3')}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          unread ? 'bg-primary text-primary-foreground' : 'bg-stone-100 text-stone-500',
        )}
        aria-hidden
      >
        <Bell className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-relaxed',
            unread ? 'font-medium text-stone-950' : 'text-stone-700',
          )}
        >
          {notification.message ?? notification.type}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-600">
          <time dateTime={notification.createdAt}>
            {relativeTime(notification.createdAt, locale)}
          </time>
          {notification.reportId ? (
            <Link
              href={`/reports/${notification.reportId}`}
              className="inline-flex min-h-9 items-center font-medium text-mosque-800 underline-offset-2 hover:underline"
            >
              {t('openReport')}
            </Link>
          ) : null}
          {unread && onMarkRead ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onMarkRead(notification.id)}
              className="min-h-9 gap-1 px-2"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              {t('markRead')}
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
