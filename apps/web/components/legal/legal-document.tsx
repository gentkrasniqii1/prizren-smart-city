import type { ReactNode } from 'react';
import { BrandWordmark } from '@/components/brand';
import { PageContainer } from '@/components/layout/page-container';

export function LegalDocument({
  title,
  updated,
  disclaimer,
  children,
}: {
  title: string;
  updated: string;
  disclaimer: string;
  children: ReactNode;
}) {
  return (
    <main className="py-10 md:py-14">
      <PageContainer width="default">
        <div className="mx-auto max-w-3xl">
          <BrandWordmark />
          <h1 className="mt-8 text-h1 tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {disclaimer}
          </p>
          <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-foreground">
            {children}
          </div>
        </div>
      </PageContainer>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-h3 text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
