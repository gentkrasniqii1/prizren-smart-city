import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SiteHeader } from '@/components/site-header';

/**
 * App chrome: header + main + footer + mobile bottom nav.
 * Pages own their inner layout; this only provides global rhythm and safe areas.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div id="main-content" className="flex-1 outline-none" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter />
      <MobileBottomNav />
    </div>
  );
}
