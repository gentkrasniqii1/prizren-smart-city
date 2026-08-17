'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('Theme');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="icon"
        size="sm"
        className={cn('shrink-0', className)}
        aria-label={t('label')}
        disabled
      >
        <Sun className="h-4 w-4 opacity-40" aria-hidden />
      </Button>
    );
  }

  return (
    // `modal={false}`: the default modal mode makes Radix add
    // `data-scroll-locked` to <body>, which forces `overflow: hidden` on it.
    // That turns <body> into a second scroll/clipping container in the same
    // chain as our sticky <header>, so while this menu is open the header's
    // sticky offset gets computed against <body>'s (unscrolled) box instead
    // of the real scrolled viewport — it snaps to its unstuck flow position
    // and disappears off-screen for as long as the menu stays open. A tiny
    // theme picker doesn't need modal scroll-locking, so we opt out of it.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="icon"
          size="sm"
          className={cn('shrink-0', className)}
          aria-label={t('label')}
        >
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" aria-hidden />
          ) : theme === 'light' ? (
            <Sun className="h-4 w-4" aria-hidden />
          ) : (
            <Monitor className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" aria-hidden />
          {t('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" aria-hidden />
          {t('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" aria-hidden />
          {t('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
