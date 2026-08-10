import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transparenca',
  description: 'Statistika agregate publike për raportet e Prizren Smart City.',
  openGraph: {
    title: 'Transparenca · Prizren Smart City',
    description: 'Statistika agregate publike për raportet e Prizren Smart City.',
  },
};

export default function TransparencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
