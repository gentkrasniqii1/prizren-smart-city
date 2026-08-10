import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AuthProvider } from '@/components/auth-provider';
import { SiteHeader } from '@/components/site-header';
import { SentryInit } from '@/components/sentry-init';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prizren Smart City',
    description: 'Raporto dhe ndiq problemet urbane në Prizren.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sq">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-stone-50 antialiased`}
      >
        <AuthProvider>
          <SentryInit />
          <SiteHeader />
          <div id="main-content">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
