'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Split-screen civic auth layout.
 * Desktop: photograph + form. Mobile: compact top visual, form immediately below.
 */
export function AuthShell({
  imageSrc,
  imageAlt,
  headline = 'Raporto. Ndiq. Ndrysho.',
  body = 'Platformë qytetare për raportimin dhe ndjekjen e problemeve urbane.',
  children,
}: {
  imageSrc: string;
  imageAlt: string;
  headline?: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-[center_78%]"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-overlay-surface/50" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-r from-overlay-surface/92 via-overlay-surface/55 to-overlay-surface/15"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/30 to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex h-full flex-col justify-end p-12 xl:p-16">
          <div className="max-w-md">
            <Link href="/" className="inline-flex text-overlay-foreground">
              <Logo variant="full" theme="dark" size={44} />
            </Link>
            <h2 className="ds-display mt-10 text-overlay-foreground xl:text-display-lg">
              {headline}
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-overlay-muted xl:text-lg">
              {body}
            </p>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="relative h-[8.5rem] shrink-0 overflow-hidden lg:hidden">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover object-[center_70%]"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-overlay-surface/55" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/40 to-overlay-surface/15"
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-gutter pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 lg:items-center lg:justify-center lg:py-8">
          <div className="w-full min-w-0 lg:max-w-[26rem] lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-10 lg:shadow-sm">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
