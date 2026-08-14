import type { ReactNode } from 'react';
import { LayoutChrome } from '@/components/layout/layout-chrome';
import { SiteFooter } from '@/components/layout/site-footer';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { SiteHeader } from '@/components/site-header';

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <LayoutChrome header={<SiteHeader />} footer={<SiteFooter />} nav={<MobileBottomNav />}>
      <div id="main-content" className="flex-1 outline-none" tabIndex={-1}>
        {children}
      </div>
    </LayoutChrome>
  );
}
