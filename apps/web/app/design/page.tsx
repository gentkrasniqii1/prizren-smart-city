import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { DesignSystemGallery } from '@/components/design/design-system-gallery';
import { Logo } from '@/components/brand/Logo';
import { PageContainer } from '@/components/layout/page-container';
import { colors, visualLanguage } from '@/lib/design-tokens';
import type { AppLocale } from '@/i18n/request';

export const metadata: Metadata = {
  title: 'Visual language',
  robots: { index: false, follow: false },
};

const COPY = {
  sq: {
    kicker: 'Gjuha vizuale',
    title: 'Prizren, jo një dashboard.',
    lead: 'Raportimi qytetar duhet të duket si qyteti — gur, lumë, autoritet komunal. Jo si një produkt bankar, as si SaaS i përgjithshëm.',
    placeTitle: 'Nga vjen ngjyra',
    place: [
      {
        name: 'Stone',
        origin: 'Guri i Kalasë, kalldrëmi, letra e dosjes.',
        use: 'Sipërfaqe, tekst, kufij. Sfondi i qytetit.',
      },
      {
        name: 'Mosque',
        origin: 'Blu e plumbtë e xhamisë Sinan Pasha — autoritet, jo “tech blue”.',
        use: 'Veprimi kryesor, fokus, lidhja me institucionin.',
      },
      {
        name: 'River',
        origin: 'Lumbardhi i Prizrenit.',
        use: 'Sukses, e zgjidhur, besim. Kurrë si ngjyra e markës kryesore.',
      },
      {
        name: 'Gilt',
        origin: 'Metali ceremonial, bakri i çative në mbrëmje.',
        use: 'Vula. Logo, eyebrow, momente të rralla. Kurrë mbushje e madhe.',
      },
    ],
    typeTitle: 'Hierarkia: Display · H1 · H2 · H3 · Body · Small · Caption · Label',
    cityVoice: 'Display — zëri civic',
    cityVoiceBody:
      'Fraunces, vetëm për hero, fjalën e markës dhe momente editoriale. Jo për çdo titull, jo për UI.',
    toolVoice: 'Aplikacioni — Manrope',
    toolVoiceBody:
      'H1, H2, H3, trupi, small, caption, label. Sans-serif modern për format, tabelat, navigimin dhe të dhënat.',
    audienceTitle: 'Një material, katër dendësi',
    audiences: {
      citizen: 'Editorial. Fotografi e Prizrenit, një veprim kryesor, harta si qytet.',
      staff:
        'Të njëjtat materiale, informacion më i dendur. Letër e ngrohtë — jo cockpit i ftohtë.',
      admin: 'Nivel auditimi. Tabela dhe regjistra së pari. Gilt kurrë për alarme.',
      public: 'Një libër civic. Numra dhe harta, jo metrika marketingu.',
    },
    doTitle: 'Bëj',
    dontTitle: 'Mos bëj',
    do: [
      'Fotografi të vërteta të Prizrenit, jo stock “smart city”.',
      'Një veprim kryesor për qytetarin (Raporto).',
      'Harta si qytet, jo si widget i errët.',
      'Etiketa njerëzore: Dërguar, jo SUBMITTED.',
      'Kontrast WCAG, synim prekjeje 44px, fokus i dukshëm.',
    ],
    dont: [
      'Sidebar i errët me grafikë indigo — duket bankë.',
      'Xham i ngrirë, neon, gradientë “future”.',
      'Inter / Geist / purple SaaS.',
      'Gilt në butona, grafikë, ose alarme.',
      'Kartë metrike e njëjtë e përsëritur 12 herë.',
      'Serif në çdo titull — Fraunces është Display, jo sistemi i titujve.',
    ],
    componentsTitle: 'Komponentët në këtë gjuhë',
    palettesTitle: 'Shkallët',
    systemTitle: 'Sistemi i dizajnit',
  },
  en: {
    kicker: 'Visual language',
    title: 'Prizren, not a dashboard.',
    lead: 'Civic reporting should look like the city — stone, river, municipal authority. Not like a banking product, and not like generic SaaS.',
    placeTitle: 'Where colour comes from',
    place: [
      {
        name: 'Stone',
        origin: 'Kalaja limestone, cobble, the paper of a dossier.',
        use: 'Surfaces, type, borders. The city’s ground.',
      },
      {
        name: 'Mosque',
        origin: 'Lead-blue of Sinan Pasha — authority, not “tech blue”.',
        use: 'Primary action, focus, the institution.',
      },
      {
        name: 'River',
        origin: 'Lumbardh i Prizrenit.',
        use: 'Success, resolved, trust. Never the primary brand fill.',
      },
      {
        name: 'Gilt',
        origin: 'Ceremonial metal, copper roofs at dusk.',
        use: 'A stamp. Logo, eyebrows, rare civic moments. Never a large fill.',
      },
    ],
    typeTitle: 'Hierarchy: Display · H1 · H2 · H3 · Body · Small · Caption · Label',
    cityVoice: 'Display — civic voice',
    cityVoiceBody:
      'Fraunces, only for the hero, wordmark, and rare editorial moments. Not every heading, not the UI.',
    toolVoice: 'Application — Manrope',
    toolVoiceBody:
      'H1, H2, H3, body, small, caption, label. A modern sans for forms, tables, navigation, and data.',
    audienceTitle: 'One material, four densities',
    audiences: {
      citizen: 'Editorial. Photography of Prizren, one primary action, map as the city.',
      staff: 'Same materials, denser information. Warm paper — not a cool gray cockpit.',
      admin: 'Audit-grade. Tables and logs first. Gilt is never used for alerts.',
      public: 'A civic ledger. Counts and maps, not marketing metrics.',
    },
    doTitle: 'Do',
    dontTitle: 'Don’t',
    do: [
      'Real photographs of Prizren, not stock “smart city”.',
      'One primary action for the citizen (Report).',
      'The map as the city, not a dark widget.',
      'Human labels: Submitted, not SUBMITTED.',
      'WCAG contrast, 44px touch, a visible focus ring.',
    ],
    dont: [
      'A cool dark sidebar with indigo charts — that is a bank.',
      'Frosted glass, neon, “future” gradients.',
      'Inter / Geist / purple SaaS.',
      'Gilt on buttons, charts, or alerts.',
      'The same metric card repeated twelve times.',
      'Serif on every heading — Fraunces is Display, not the heading system.',
    ],
    componentsTitle: 'Components in this language',
    palettesTitle: 'Scales',
    systemTitle: 'Design system',
  },
} as const;

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="h-12 rounded-md border border-border" style={{ background: hex }} />
      <p className="mt-1.5 truncate text-[11px] font-medium text-foreground">{label}</p>
      <p className="truncate font-mono text-[10px] text-muted-foreground">{hex}</p>
    </div>
  );
}

function Scale({ name, steps }: { name: string; steps: Record<string, string> }) {
  return (
    <div>
      <h3 className="text-label font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {name}
      </h3>
      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-11">
        {Object.entries(steps).map(([step, hex]) => (
          <Swatch key={step} hex={hex} label={step} />
        ))}
      </div>
    </div>
  );
}

export default async function DesignLanguagePage() {
  const locale = (await getLocale()) as AppLocale;
  const t = COPY[locale === 'sq' ? 'sq' : 'en'];
  const audiences = [
    { key: 'citizen' as const, label: locale === 'sq' ? 'Qytetarë' : 'Citizens' },
    { key: 'staff' as const, label: locale === 'sq' ? 'Stafi komunal' : 'Municipal staff' },
    { key: 'admin' as const, label: locale === 'sq' ? 'Administratorë' : 'Administrators' },
    {
      key: 'public' as const,
      label: locale === 'sq' ? 'Institucione publike' : 'Public institutions',
    },
  ];

  return (
    <main className="pb-24">
      <div className="border-b border-border bg-mosque-950">
        <PageContainer className="py-16 sm:py-20">
          <p className="ds-kicker">{t.kicker}</p>
          <h1 className="ds-display mt-gutter max-w-3xl text-overlay-foreground sm:text-display-lg">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-overlay-muted sm:text-lg">{t.lead}</p>
          <div className="mt-8">
            <Logo variant="full" theme="dark" size={40} />
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {visualLanguage.personality.map((item) => (
              <span
                key={item}
                className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-caption uppercase tracking-[0.12em] text-overlay-foreground"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {visualLanguage.not.map((item) => (
              <span
                key={item}
                className="rounded-md px-2.5 py-1 text-caption uppercase tracking-[0.12em] text-overlay-muted line-through decoration-white/30"
              >
                {item}
              </span>
            ))}
          </div>
        </PageContainer>
      </div>

      <PageContainer className="space-y-16 py-14 sm:py-20">
        <section>
          <h2 className="ds-section-title">{t.placeTitle}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {t.place.map((item) => (
              <li key={item.name} className="rounded-lg border border-border bg-card p-5">
                <p className="ds-card-title">{item.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.origin}</p>
                <p className="mt-3 text-sm text-foreground">{item.use}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="ds-section-title">{t.palettesTitle}</h2>
          <div className="mt-8 space-y-8">
            <Scale name="Stone" steps={colors.stone} />
            <Scale name="Mosque" steps={colors.mosque} />
            <Scale name="River" steps={colors.river} />
            <div>
              <h3 className="text-label font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Gilt
              </h3>
              <div className="mt-3 max-w-[7rem]">
                <Swatch hex={colors.brand.gold} label="stamp" />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="ds-section-title">{t.typeTitle}</h2>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gilt">
                {visualLanguage.typeRoles.display.family}
              </p>
              <p className="ds-display mt-cluster text-foreground">{t.cityVoice}</p>
              <p className="mt-3 text-sm text-muted-foreground">{t.cityVoiceBody}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-caption font-semibold uppercase tracking-[0.18em] text-gilt">
                {visualLanguage.typeRoles.sans.family}
              </p>
              <p className="mt-3 text-h2 text-foreground">{t.toolVoice}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t.toolVoiceBody}
              </p>
              <p className="mt-4 font-mono text-sm tabular-nums text-foreground">PRZ-2026-000184</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="ds-section-title">{t.audienceTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {audiences.map((item) => (
              <article key={item.key} className="rounded-lg border border-border bg-card p-5">
                <h3 className="ds-card-title">{item.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.audiences[item.key]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="ds-section-title">{t.doTitle}</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              {t.do.map((item) => (
                <li key={item} className="border-l-2 border-river-500 pl-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="ds-section-title">{t.dontTitle}</h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              {t.dont.map((item) => (
                <li key={item} className="border-l-2 border-border pl-3 text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="ds-section-title">{t.systemTitle}</h2>
          <p className="mt-cluster max-w-2xl text-sm text-muted-foreground">{t.componentsTitle}</p>
          <div className="mt-8">
            <DesignSystemGallery locale={locale === 'sq' ? 'sq' : 'en'} />
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
