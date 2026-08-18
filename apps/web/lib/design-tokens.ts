/**
 * Prizren Smart City — single source of visual truth.
 * Mirrored in `app/globals.css` (:root) and `tailwind.config.ts`.
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
    pending: { bg: '#e6ddd0', fg: '#473e35' },
    inReview: { bg: '#c2d7ed', fg: '#19253a' },
    assigned: { bg: '#d4c5b0', fg: '#27211c' },
    inProgress: { bg: '#fde68a', fg: '#78350f' },
    resolved: { bg: '#b8e6dc', fg: '#0f2725' },
    rejected: { bg: '#fecaca', fg: '#7f1d1d' },
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

/** Typography scale — Fraunces = display, Manrope = sans body */
export const typography = {
  display: { size: '2.25rem', lineHeight: '1.15', weight: 600 },
  h1: { size: '1.875rem', lineHeight: '1.2', weight: 600 },
  h2: { size: '1.5rem', lineHeight: '1.25', weight: 600 },
  h3: { size: '1.25rem', lineHeight: '1.3', weight: 600 },
  body: { size: '1rem', lineHeight: '1.55', weight: 400 },
  small: { size: '0.875rem', lineHeight: '1.45', weight: 400 },
  caption: { size: '0.75rem', lineHeight: '1.4', weight: 500 },
  label: { size: '0.875rem', lineHeight: '1.4', weight: 500 },
} as const;

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
  /** Two typefaces only. Fraunces speaks for the city; Manrope runs the tools. */
  typeRoles: {
    display: {
      family: 'Fraunces',
      role: 'City voice — hero, page titles, card titles, wordmark',
    },
    sans: {
      family: 'Manrope',
      role: 'Institution tools — body, forms, tables, navigation, data',
    },
  },
  surfaces: {
    citizen: 'Editorial. Photography of Prizren, one primary action, map as the city.',
    staff: 'Same materials, denser information. Warm paper — not a cool gray cockpit.',
    admin: 'Audit-grade. Tables and logs first. Gilt is never used for alerts.',
    public: 'A civic ledger. Counts and maps, not marketing metrics.',
  },
} as const;
