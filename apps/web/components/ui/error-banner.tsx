'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorBanner({
  title,
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations('Common');

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title ?? t('errorTitle')}</p>
        <p className="mt-0.5 text-destructive/90">{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="mt-1.5 h-auto px-0 py-0 text-destructive underline underline-offset-2 hover:bg-transparent hover:text-destructive"
          >
            {t('retry')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
