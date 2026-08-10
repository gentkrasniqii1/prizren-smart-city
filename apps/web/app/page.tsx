import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d6d3d1_0%,_#f5f5f4_45%,_#e7e5e4_100%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-4 py-12 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-600 sm:text-sm">
          Prizren
        </p>
        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-geist-sans)] text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl md:text-6xl">
          Prizren Smart City
        </h1>
        <p className="mt-4 max-w-xl text-base text-stone-700 sm:text-lg">
          Raporto probleme urbane. Ndiq zgjidhjen. Transparencë për qytetin.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/report"
            className="rounded-md bg-stone-900 px-5 py-2.5 text-center text-white hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
          >
            Raporto një problem
          </Link>
          <Link
            href="/reports"
            className="rounded-md border border-stone-400 bg-white/70 px-5 py-2.5 text-center text-stone-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
          >
            Shiko raportet
          </Link>
          <Link
            href="/transparency"
            className="rounded-md border border-stone-400 bg-white/70 px-5 py-2.5 text-center text-stone-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
          >
            Transparenca
          </Link>
        </div>
      </div>
    </main>
  );
}
