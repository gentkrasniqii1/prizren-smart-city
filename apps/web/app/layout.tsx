import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AuthProvider } from '@/components/auth-provider';
import { SiteShell } from '@/components/layout/site-shell';
import { SentryInit } from '@/components/sentry-init';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/toast-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf8f5',
};

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Prizren Smart City',
    template: '%s · Prizren Smart City',
  },
  description: 'Raporto dhe ndiq problemet urbane në Prizren — transparencë për qytetin.',
  openGraph: {
    type: 'website',
    locale: 'sq_AL',
    siteName: 'Prizren Smart City',
    title: 'Prizren Smart City',
    description: 'Raporto dhe ndiq problemet urbane në Prizren — transparencë për qytetin.',
    images: [{ url: '/images/prizren/overview.jpg', width: 1200, height: 800 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prizren Smart City',
    description: 'Raporto dhe ndiq problemet urbane në Prizren.',
  },
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${display.variable} ${sans.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <AuthProvider>
              <ToastProvider>
                <SentryInit />
                <SiteShell>{children}</SiteShell>
                <Toaster richColors closeButton position="bottom-right" />
              </ToastProvider>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
