/** Visual identity tokens — Prizren stone, mosque blue, Bistrica teal */
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
  status: {
    pending: { bg: '#e6ddd0', fg: '#473e35' },
    inReview: { bg: '#c2d7ed', fg: '#19253a' },
    assigned: { bg: '#d4c5b0', fg: '#27211c' },
    inProgress: { bg: '#fde68a', fg: '#78350f' },
    resolved: { bg: '#b8e6dc', fg: '#0f2725' },
    rejected: { bg: '#fecaca', fg: '#7f1d1d' },
  },
} as const;

export const radii = {
  sm: '0.375rem',
  md: '0.625rem',
  lg: '1rem',
  xl: '1.25rem',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgb(39 33 28 / 0.06)',
  md: '0 8px 24px rgb(39 33 28 / 0.08)',
  lg: '0 18px 48px rgb(39 33 28 / 0.12)',
} as const;
