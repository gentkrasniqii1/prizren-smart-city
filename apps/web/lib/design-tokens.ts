/**
 * Prizren Smart City — single source of visual truth.
 * Mirrored in `app/globals.css` (:root) and `tailwind.config.js`.
 *
 * Identity is drawn from the city, not from a dashboard kit:
 *   stone  — Kalaja limestone, cobble, paper
 *   mosque — civic authority (Sinan Pasha lead-blue, not “tech blue”)
 *   river  — Lumbardh i Prizrenit
 *   gilt   — ceremonial metal / evening copper. A stamp, never a fill.
 */

export const colors = {
  stone: {
    50: '#faf8f5',
    100: '#f3efe8',
    200: '#e6ddd0',
    300: '#d4c5b0',
    400: '#b8a48a',
    500: '#9a856c',
    600: '#7d6a55',
    700: '#655645',
    800: '#54483c',
    900: '#473e35',
    950: '#27211c',
  },
  mosque: {
    50: '#f0f5fb',
    100: '#dde9f5',
    200: '#c2d7ed',
    300: '#98bbe0',
    400: '#6798cf',
    500: '#4479b8',
    600: '#335f9b',
    700: '#2b4d7d',
    800: '#274368',
    900: '#253a57',
    950: '#19253a',
  },
  river: {
    50: '#f0faf8',
    100: '#daf3ee',
    200: '#b8e6dc',
    300: '#89d3c5',
    400: '#56b7a7',
    500: '#3a9b8c',
    600: '#2c7c71',
    700: '#27645c',
    800: '#23514b',
    900: '#21443f',
    950: '#0f2725',
  },
  semantic: {
    success: { bg: '#b8e6dc', fg: '#0f2725' },
    warning: { bg: '#fde68a', fg: '#78350f' },
    danger: { bg: '#fecaca', fg: '#7f1d1d' },
    info: { bg: '#c2d7ed', fg: '#19253a' },
  },
  status: {
    submitted: { bg: '#e6ddd0', fg: '#473e35' },
    received: { bg: '#98bbe0', fg: '#19253a' },
    underReview: { bg: '#2b4d7d', fg: '#f0f5fb' },
    assigned: { bg: '#d4c5b0', fg: '#27211c' },
    inProgress: { bg: '#fde68a', fg: '#78350f' },
    waiting: { bg: '#fed7aa', fg: '#7c2d12' },
    resolved: { bg: '#b8e6dc', fg: '#0f2725' },
    rejected: { bg: '#fecaca', fg: '#7f1d1d' },
    duplicate: { bg: '#cbd5e1', fg: '#1e293b' },
  },
  priority: {
    low: { bg: '#e6ddd0', fg: '#473e35' },
    medium: { bg: '#fde68a', fg: '#78350f' },
    high: { bg: '#fed7aa', fg: '#7c2d12' },
    critical: { bg: '#fecaca', fg: '#7f1d1d' },
  },
  /**
   * Ceremonial metal. Fixed across themes. Use for the mark, eyebrows, and
   * rare civic stamps — never for primary buttons, charts, or large fills.
   */
  brand: {
    gold: '#b8874f',
  },
} as const;

export const radii = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgb(39 33 28 / 0.06)',
  md: '0 8px 24px rgb(39 33 28 / 0.08)',
  lg: '0 18px 48px rgb(39 33 28 / 0.12)',
} as const;

/**
 * Type hierarchy. Manrope is the UI face. Fraunces is Display only —
 * civic/editorial branding (hero, wordmark), never every heading.
 *
 * Display · H1 · H2 · H3 · Body · Small · Caption · Label
 */
export const typography = {
  displayXl: {
    family: 'Fraunces',
    size: '3.75rem',
    lineHeight: '1.1',
    weight: 600,
    letterSpacing: '-0.03em',
  },
  displayLg: {
    family: 'Fraunces',
    size: '3rem',
    lineHeight: '1.15',
    weight: 600,
    letterSpacing: '-0.025em',
  },
  display: {
    family: 'Fraunces',
    size: '2.25rem',
    lineHeight: '1.15',
    weight: 600,
    letterSpacing: '-0.02em',
  },
  h1: {
    family: 'Manrope',
    size: '1.875rem',
    lineHeight: '1.2',
    weight: 600,
    letterSpacing: '-0.02em',
  },
  h2: {
    family: 'Manrope',
    size: '1.5rem',
    lineHeight: '1.25',
    weight: 600,
    letterSpacing: '-0.015em',
  },
  h3: {
    family: 'Manrope',
    size: '1.25rem',
    lineHeight: '1.3',
    weight: 600,
    letterSpacing: '-0.01em',
  },
  body: {
    family: 'Manrope',
    size: '1rem',
    lineHeight: '1.55',
    weight: 400,
    letterSpacing: '0',
  },
  small: {
    family: 'Manrope',
    size: '0.875rem',
    lineHeight: '1.45',
    weight: 400,
    letterSpacing: '0',
  },
  caption: {
    family: 'Manrope',
    size: '0.75rem',
    lineHeight: '1.4',
    weight: 500,
    letterSpacing: '0.01em',
  },
  label: {
    family: 'Manrope',
    size: '0.875rem',
    lineHeight: '1.4',
    weight: 500,
    letterSpacing: '0',
  },
} as const;

/** Named roles for the specimen — Display has responsive steps (lg / xl). */
export const typeHierarchy = [
  { name: 'Display', token: 'display', use: 'Hero, wordmark, rare civic/editorial moments' },
  { name: 'H1', token: 'h1', use: 'Page titles' },
  { name: 'H2', token: 'h2', use: 'Section titles' },
  { name: 'H3', token: 'h3', use: 'Card and dialog titles' },
  { name: 'Body', token: 'body', use: 'Default copy' },
  { name: 'Small', token: 'small', use: 'Secondary copy, help text' },
  { name: 'Caption', token: 'caption', use: 'Meta, timestamps, footnotes' },
  { name: 'Label', token: 'label', use: 'Form labels, compact UI labels' },
] as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

/** Named spacing — prefer these over ad-hoc Tailwind steps. */
export const space = {
  cluster: spacing[3],
  gutter: spacing[4],
  inset: spacing[5],
  stack: spacing[6],
  section: spacing[10],
} as const;

export const control = {
  sm: '2.5rem',
  md: '2.75rem',
  lg: '3rem',
} as const;

/**
 * Viewport widths we actually test. Layout chrome switches at `lg` (1024).
 * Phones (320–430) and tablet portrait (768) share stacked mobile chrome.
 */
export const breakpoints = {
  phoneMin: 320,
  phone: 375,
  phoneMd: 390,
  phoneLg: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  desktopWide: 1440,
  fullHd: 1920,
} as const;

export const motion = {
  fast: '120ms',
  normal: '200ms',
  slow: '320ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const focusRing =
  'outline outline-2 outline-offset-2 outline-[var(--color-mosque-700)]' as const;

/**
 * Visual language — how the tokens are meant to be used.
 * Living specimen: `/design` (unlisted, noindex).
 */
export const visualLanguage = {
  name: 'Prizren Smart City',
  product: 'Civic Reporting Platform',
  personality: [
    'trustworthy',
    'civic',
    'modern',
    'accessible',
    'professional',
    'local',
    'clean',
    'technology-driven',
  ] as const,
  not: [
    'overly futuristic',
    'generic SaaS',
    'banking dashboard',
    'neon smart-city chrome',
  ] as const,
  /**
   * Two typefaces, strict roles. Fraunces is a stamp — not the heading system.
   */
  typeRoles: {
    display: {
      family: 'Fraunces',
      role: 'Selective civic/editorial — hero, wordmark. Never H1–H3 or app chrome.',
    },
    sans: {
      family: 'Manrope',
      role: 'Application UI — H1, H2, H3, body, small, caption, label, forms, tables, data',
    },
  },
  surfaces: {
    citizen: 'Editorial. Photography of Prizren, one primary action, map as the city.',
    staff: 'Same materials, denser information. Warm paper — not a cool gray cockpit.',
    admin: 'Audit-grade. Tables and logs first. Gilt is never used for alerts.',
    public: 'A civic ledger. Counts and maps, not marketing metrics.',
    chrome:
      'Navbar is application chrome, not a toolbar dump. Desktop: logo, three links, one CTA; utilities on the right. Below lg: logo + menu, links in a Sheet.',
  },
} as const;

/**
 * Component recipes — the only radii, type, and spacing the UI should use.
 * Living specimen: `/design`.
 */
export const recipes = {
  radius: {
    control: 'md',
    nested: 'lg',
    surface: 'xl',
  },
  type: {
    display: 'Fraunces — hero / wordmark only (display → display-lg → display-xl)',
    pageTitle: 'H1 · Manrope · ds-page-title',
    sectionTitle: 'H2 · Manrope · ds-section-title',
    cardTitle: 'H3 · Manrope · ds-card-title',
    body: 'Body · Manrope · text-body',
    small: 'Small · Manrope · text-small',
    meta: 'Caption · Manrope · text-caption',
    label: 'Label · Manrope · text-label',
  },
  space: {
    cluster: 'gap-cluster (0.75rem) — chips, button groups',
    gutter: 'px-gutter (1rem) — page edges',
    inset: 'p-inset (1.25rem) — card / dialog padding',
    stack: 'space-y-stack (1.5rem) — form stacks',
    section: 'mt-section (2.5rem) — page sections',
  },
  shadow: {
    rest: 'sm — cards, buttons, table chrome',
    overlay: 'soft — dropdowns, popovers, tooltips',
    modal: 'lift — dialogs, toasts',
  },
  overlay: 'bg-overlay-surface/70',
  nav: {
    height: 'h-14 lg:h-16',
    link: 'text-label, min-h-11, muted until hover/active',
    cta: 'One primary — Report a problem. Never a second filled button in the bar.',
    utilities: 'Theme, notifications, language as compact 44px controls',
    identity: 'Avatar + name → profile. Logout is its own control, not a stuffed dropdown.',
  },
} as const;
