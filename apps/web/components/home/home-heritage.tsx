import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { Section, SectionHeading } from '@/components/home/section';
import { HERITAGE_GALLERY, type HeritagePlace } from '@/lib/prizren-photos';

export async function HomeHeritage() {
  const t = await getTranslations('Home');

  const labels: Record<HeritagePlace['nameKey'], string> = {
    kalaja: t('heritage.places.kalaja'),
    league: t('heritage.places.league'),
    stoneBridge: t('heritage.places.stoneBridge'),
    sinanPasha: t('heritage.places.sinanPasha'),
    shadervan: t('heritage.places.shadervan'),
    tabakhane: t('heritage.places.tabakhane'),
    marash: t('heritage.places.marash'),
    bistrica: t('heritage.places.bistrica'),
  };

  return (
    <Section id="heritage" className="scroll-mt-20">
      <PageContainer>
        <SectionHeading
          eyebrow={t('heritage.eyebrow')}
          title={t('heritage.title')}
          description={t('heritage.description')}
        />

        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {HERITAGE_GALLERY.map((place) => (
            <li key={place.nameKey} className="min-w-0">
              <figure className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <Image
                    src={place.src}
                    alt={labels[place.nameKey]}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    quality={75}
                    className="object-cover"
                  />
                </div>
                <figcaption className="px-3 py-2.5">
                  <p className="text-caption font-medium tracking-[0.04em] text-stone-700">
                    {labels[place.nameKey]}
                  </p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </PageContainer>
    </Section>
  );
}
