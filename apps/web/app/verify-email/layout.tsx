import { Suspense, type ReactNode } from 'react';
import { Spinner } from '@/components/ui';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <Spinner />
        </main>
      }
    >
      {children}
    </Suspense>
  );
}
