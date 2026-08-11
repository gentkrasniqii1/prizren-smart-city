import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandWordmark } from '@/components/brand';
import { PageContainer } from '@/components/layout/page-container';

export async function SiteFooter() {
  const t = await getTranslations('Footer');
  const year = new Date().getFullYear();

  const links = [
    { href: '/reports', label: t('reports') },
    { href: '/report', label: t('report') },
    { href: '/transparency', label: t('transparency') },
    { href: '/#how-it-works', label: t('howItWorks') },
  ];

  return (
    <footer className="border-t border-stone-200 bg-stone-100/80 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <PageContainer className="py-10 md:py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <BrandWordmark />
            <p className="mt-3 text-sm text-stone-600">{t('tagline')}</p>
          </div>

          <nav
            aria-label={t('navLabel')}
            className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-4"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-stone-700 hover:text-mosque-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-stone-200/80 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {t('copyright')}
          </p>
          <p>{t('privacyNote')}</p>
        </div>
      </PageContainer>
    </footer>
  );
}
