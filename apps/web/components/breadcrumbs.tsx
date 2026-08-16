import Link from 'next/link';

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-stone-600">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {last || !item.href ? (
                <span
                  className={last ? 'font-medium text-stone-800' : undefined}
                  aria-current={last ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-mosque-700 hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
