import type { ReactNode } from 'react';

/** Subtle fade on route change. Header/footer stay put via the root layout. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="motion-page">{children}</div>;
}
