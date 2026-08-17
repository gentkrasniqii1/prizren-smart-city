import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

export function AuthShell({
  imageSrc,
  imageAlt,
  children,
}: {
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover object-[center_30%]"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
        <div className="absolute inset-0 bg-overlay-surface/25" />
        <div className="relative z-10 flex h-full flex-col justify-center p-10 xl:p-14">
          <div className="max-w-lg rounded-xl bg-black/35 p-6 backdrop-blur-sm ring-1 ring-white/10">
            <Link href="/" className="inline-flex items-center gap-3 text-overlay-foreground">
              <Logo variant="icon" theme="dark" size={44} />
              <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                Prizren Smart City
              </span>
            </Link>
            <p className="mt-8 font-display text-4xl leading-tight tracking-tight text-overlay-foreground xl:text-5xl">
              Raporto. Ndiq. Ndrysho.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-overlay-muted">
              Platformë qytetare për problemet urbane — raportim, transparencë dhe ndjekje të
              rasteve.
            </p>
          </div>
        </div>
      </aside>

      <section className="flex min-h-dvh flex-col">
        <div className="relative h-36 overflow-hidden sm:h-44 lg:hidden">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover object-[center_35%]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-black/50 to-black/40" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-overlay-foreground">
              Prizren Smart City
            </p>
            <p className="font-display text-xl text-overlay-foreground">Raporto. Ndiq. Ndrysho.</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 pt-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
            <Logo variant="icon" size={32} />
            <span className="text-sm font-semibold tracking-tight">Prizren Smart City</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-md motion-fade-up">{children}</div>
        </div>
      </section>
    </div>
  );
}
