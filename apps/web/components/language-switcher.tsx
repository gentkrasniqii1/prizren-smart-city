'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  variant = 'segmented',
  className,
}: {
  variant?: 'segmented' | 'compact';
  className?: string;
}) {
  const t = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(next: 'sq' | 'en') {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="icon"
            size="sm"
            className={cn('shrink-0 text-caption font-semibold', className)}
            aria-label={t('language')}
            disabled={pending}
          >
            {locale === 'en' ? 'EN' : 'SQ'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[8rem]">
          <DropdownMenuItem disabled={pending || locale === 'sq'} onClick={() => setLocale('sq')}>
            SQ
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending || locale === 'en'} onClick={() => setLocale('en')}>
            EN
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-card p-0.5 text-caption font-semibold',
        className,
      )}
      role="group"
      aria-label={t('language')}
    >
      <button
        type="button"
        disabled={pending || locale === 'sq'}
        onClick={() => setLocale('sq')}
        aria-pressed={locale === 'sq'}
        lang="sq"
        className={cn(
          'min-h-11 min-w-11 rounded px-2.5 py-2',
          locale === 'sq'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        SQ
      </button>
      <button
        type="button"
        disabled={pending || locale === 'en'}
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        lang="en"
        className={cn(
          'min-h-11 min-w-11 rounded px-2.5 py-2',
          locale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted',
        )}
      >
        EN
      </button>
    </div>
  );
}
