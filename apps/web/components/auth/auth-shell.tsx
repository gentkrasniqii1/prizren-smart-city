'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AuthHeroSlideshow } from '@/components/auth/auth-hero-slideshow';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Split-screen civic auth layout.
 * Desktop: photograph slideshow + form. Mobile: compact top visual, form below.
 */
export function AuthShell({
  imageAlt,
  headline = 'Raporto. Ndiq. Ndrysho.',
  body = 'Platformë qytetare për raportimin dhe ndjekjen e problemeve urbane.',
  children,
}: {
  imageAlt?: string;
  headline?: string;
  body?: string;
  children: ReactNode;
}) {
  const tNav = useTranslations('Nav');
  const tAuth = useTranslations('Auth');
  const alt = imageAlt ?? tAuth('heroSlideshowAlt');

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <AuthHeroSlideshow
          alt={alt}
          sizes="(min-width: 1024px) 50vw, 100vw"
          objectPosition="object-[center_72%]"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/45 to-black/20"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-black/20" aria-hidden />

        <div className="relative z-10 flex h-full flex-col justify-center px-12 xl:px-16">
          <div className="max-w-md">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-overlay-foreground"
              aria-label={tNav('home')}
            >
              <Logo variant="full" theme="dark" size={36} />
            </Link>
            <h2 className="mt-6 font-display text-h1 text-overlay-foreground drop-shadow-sm xl:text-display">
              {headline}
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-overlay-muted drop-shadow-sm xl:text-lg">
              {body}
            </p>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="relative h-[8.5rem] shrink-0 overflow-hidden lg:hidden">
          <AuthHeroSlideshow alt="" sizes="100vw" objectPosition="object-[center_68%]" />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-end gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          <div className="absolute inset-x-0 bottom-0 px-gutter pb-3">
            <p className="text-caption font-semibold uppercase tracking-[0.22em] text-gilt">
              Prizren Smart City
            </p>
            <p className="mt-1 truncate font-display text-h3 leading-tight text-overlay-foreground">
              {headline}
            </p>
          </div>
        </div>

        <div className="hidden items-center justify-end gap-1 px-8 pt-4 lg:flex">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-gutter pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 lg:items-center lg:justify-center lg:py-5">
          <div className="w-full min-w-0 lg:max-w-[26rem] lg:rounded-lg lg:border lg:border-border lg:bg-card lg:px-8 lg:py-6 lg:shadow-sm">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
