import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        ring: 'var(--ring)',
        stone: {
          50: 'var(--color-stone-50)',
          100: 'var(--color-stone-100)',
          200: 'var(--color-stone-200)',
          300: 'var(--color-stone-300)',
          400: 'var(--color-stone-400)',
          500: 'var(--color-stone-500)',
          600: 'var(--color-stone-600)',
          700: 'var(--color-stone-700)',
          800: 'var(--color-stone-800)',
          900: 'var(--color-stone-900)',
          950: 'var(--color-stone-950)',
        },
        mosque: {
          50: 'var(--color-mosque-50)',
          100: 'var(--color-mosque-100)',
          200: 'var(--color-mosque-200)',
          300: 'var(--color-mosque-300)',
          400: 'var(--color-mosque-400)',
          500: 'var(--color-mosque-500)',
          600: 'var(--color-mosque-600)',
          700: 'var(--color-mosque-700)',
          800: 'var(--color-mosque-800)',
          900: 'var(--color-mosque-900)',
          950: 'var(--color-mosque-950)',
        },
        river: {
          50: 'var(--color-river-50)',
          100: 'var(--color-river-100)',
          200: 'var(--color-river-200)',
          300: 'var(--color-river-300)',
          400: 'var(--color-river-400)',
          500: 'var(--color-river-500)',
          600: 'var(--color-river-600)',
          700: 'var(--color-river-700)',
          800: 'var(--color-river-800)',
          900: 'var(--color-river-900)',
          950: 'var(--color-river-950)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '1.15', fontWeight: '600' }],
        h1: ['1.875rem', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['1.5rem', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        label: ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-md)',
        lift: 'var(--shadow-lg)',
        sm: 'var(--shadow-sm)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        normal: 'var(--motion-normal)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        product: 'var(--motion-ease)',
      },
      keyframes: {
        'motion-fade-up': {
          from: { opacity: '0', transform: 'translateY(0.75rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'motion-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'motion-slide-up': {
          from: { opacity: '0', transform: 'translateY(1.25rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'motion-slide-in-right': {
          from: { opacity: '0', transform: 'translateX(0.85rem)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'motion-fade-up var(--motion-slow) var(--motion-ease) both',
        'fade-in': 'motion-fade-in var(--motion-normal) var(--motion-ease) both',
        'slide-up': 'motion-slide-up var(--motion-slow) var(--motion-ease) both',
        'slide-in-right': 'motion-slide-in-right var(--motion-slow) var(--motion-ease) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
