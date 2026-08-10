import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Raporte',
  description: 'Harta dhe lista publike e raporteve urbane në Prizren.',
  openGraph: {
    title: 'Raporte · Prizren Smart City',
    description: 'Harta dhe lista publike e raporteve urbane në Prizren.',
  },
};

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
