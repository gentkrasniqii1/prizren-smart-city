import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReportDto } from '@prizren/shared-types';
import { PageContainer } from '@/components/layout/page-container';
import { Section, SectionHeading } from '@/components/home/section';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/badge';
import { RemoteImage } from '@/components/remote-image';
import { getStatusLabel } from '@/lib/labels';
import type { AppLocale } from '@/i18n/request';

function excerpt(text: string, max = 110) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

export async function HomeLiveIssues({ reports }: { reports: ReportDto[] }) {
  const t = await getTranslations('Home');
  const locale = (await getLocale()) as AppLocale;

  return (
    <Section className="bg-white">
      <PageContainer>
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow={t('live.eyebrow')}
              title={t('live.title')}
              description={t('live.description')}
            />
            <Link href="/reports" className="shrink-0">
              <Button variant="secondary" size="sm">
                {t('live.viewMap')}
              </Button>
            </Link>
          </div>
        </Reveal>

        {reports.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={t('live.emptyTitle')}
              description={t('live.emptyBody')}
              action={
                <Link href="/report">
                  <Button size="sm">{t('ctaReport')}</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/reports/${report.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-stone-50/50 transition hover:border-mosque-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
                    {report.photoUrl ? (
                      <RemoteImage
                        src={report.photoUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-normal group-hover:scale-[1.02]"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-stone-500">
                        {t('live.noPhoto')}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={report.status} />
                      {report.categoryName ? (
                        <span className="text-xs text-stone-500">{report.categoryName}</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-stone-900">
                      {excerpt(report.description)}
                    </p>
                    <p className="mt-auto pt-2 text-xs text-stone-500">
                      {report.address
                        ? report.address
                        : t('live.coords', {
                            lat: report.lat.toFixed(3),
                            lng: report.lng.toFixed(3),
                          })}
                      <span className="mx-1.5 text-stone-300" aria-hidden>
                        ·
                      </span>
                      {new Date(report.createdAt).toLocaleDateString(
                        locale === 'en' ? 'en-GB' : 'sq-AL',
                      )}
                      <span className="sr-only">{getStatusLabel(report.status, locale)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </Section>
  );
}
