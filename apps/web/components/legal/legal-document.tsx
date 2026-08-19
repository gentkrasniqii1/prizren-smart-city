import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/page-container';

export type LegalTocItem = {
  id: string;
  label: string;
  review?: boolean;
};

export function LegalDocument({
  kicker,
  title,
  updated,
  disclaimer,
  reviewLabel,
  reviewShort,
  contentsLabel,
  related,
  toc,
  children,
}: {
  kicker: string;
  title: string;
  updated: string;
  disclaimer: string;
  reviewLabel: string;
  reviewShort: string;
  contentsLabel: string;
  related?: { href: string; label: string };
  toc: LegalTocItem[];
  children: ReactNode;
}) {
  return (
    <main className="bg-muted/30 pb-bottom-nav pt-8 sm:pt-10">
      <PageContainer>
        <article className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-gutter shadow-sm sm:p-8">
          <p className="ds-kicker">{kicker}</p>
          <h1 className="ds-page-title mt-3">{title}</h1>
          <hr className="mt-4 w-16 border-t border-gilt" />
          <p className="mt-4 text-small text-muted-foreground">{updated}</p>

          <aside
            role="note"
            className="mt-6 rounded-xl border border-semantic-warning bg-semantic-warning px-inset py-gutter text-semantic-warning-foreground"
          >
            <p className="text-caption font-semibold uppercase tracking-[0.14em]">{reviewLabel}</p>
            <p className="mt-2 text-small leading-relaxed">{disclaimer}</p>
          </aside>

          <nav
            aria-labelledby="legal-toc-heading"
            className="mt-8 rounded-xl border border-border bg-muted/40 p-inset"
          >
            <h2 id="legal-toc-heading" className="text-label font-semibold text-foreground">
              {contentsLabel}
            </h2>
            <ol className="mt-4 space-y-1">
              {toc.map((item, index) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 py-2 text-small text-foreground hover:bg-card"
                  >
                    <span className="w-6 shrink-0 font-mono text-caption text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.review ? (
                      <span className="hidden shrink-0 text-caption uppercase tracking-[0.12em] text-gilt sm:inline">
                        {reviewShort}
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-2 divide-y divide-border">{children}</div>

          {related ? (
            <p className="mt-8 border-t border-border pt-6 text-small text-muted-foreground">
              <Link
                href={related.href}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {related.label}
              </Link>
            </p>
          ) : null}
        </article>
      </PageContainer>
    </main>
  );
}

export function LegalSection({
  id,
  index,
  title,
  review,
  reviewLabel,
  children,
}: {
  id: string;
  index: number;
  title: string;
  review?: boolean;
  reviewLabel?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="ds-section-title">
          <span className="mr-3 font-mono text-caption font-semibold text-muted-foreground">
            {String(index).padStart(2, '0')}{' '}
          </span>
          {title}
        </h2>
        {review && reviewLabel ? (
          <span className="text-caption font-semibold uppercase tracking-[0.14em] text-gilt">
            {reviewLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-3 text-body text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalPlaceholder({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-muted/50 px-gutter py-3 text-small text-foreground">
      {children}
    </p>
  );
}
