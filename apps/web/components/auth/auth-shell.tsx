'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Split-screen civic auth layout.
 * Left: Prizren photograph with a left/bottom type well — copy never sits on the sky.
 * Right: quiet paper panel for the form.
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
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-[center_78%]"
          sizes="50vw"
          priority
        />
        {/* Even dim so pale winter sky cannot punch through the type. */}
        <div className="absolute inset-0 bg-overlay-surface/50" aria-hidden />
        {/* Type well: left and bottom. Architecture stays visible on the right. */}
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
            <h2 className="mt-10 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-overlay-foreground xl:text-5xl">
              {headline}
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-overlay-muted xl:text-lg">
              {body}
            </p>
          </div>
        </div>
      </aside>

      <section className="flex min-h-dvh flex-col bg-background">
        <div className="relative h-44 overflow-hidden sm:h-52 lg:hidden">
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
            className="absolute inset-0 bg-gradient-to-t from-overlay-surface/90 via-overlay-surface/40 to-overlay-surface/20"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 max-w-md px-5 pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gilt">
              Prizren Smart City
            </p>
            <p className="mt-1 font-display text-2xl font-semibold leading-tight text-overlay-foreground">
              {headline}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 px-5 pt-4 sm:px-8">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[26rem] motion-fade-up lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-10 lg:shadow-sm">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
