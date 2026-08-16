'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPinned, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input, Label } from '@/components/ui/field';
import { cn } from '@/lib/utils';

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export function AddressSearch({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (next: string) => void;
  onPick: (lat: number, lng: number, label: string) => void;
}) {
  const t = useTranslations('ReportFlow');
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setBusy(false);
      setError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(true);
      setError(null);

      const params = new URLSearchParams({ q });

      void fetch(`/api/geocode/search?${params}`, {
        signal: ac.signal,
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('search failed');
          const body = (await res.json()) as { results?: NominatimResult[] };
          return body.results ?? [];
        })
        .then((data) => {
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setResults([]);
          setError(t('addressSearchError'));
        })
        .finally(() => setBusy(false));
    }, 400);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, t]);

  function pick(item: NominatimResult) {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const label = item.display_name;
    onChange(label);
    setQuery(label);
    onPick(lat, lng, label);
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="relative">
      <Label htmlFor="report-address-search">{t('addressLabel')}</Label>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <Input
          id="report-address-search"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={t('addressPlaceholder')}
          className="mt-0 pl-9 pr-9"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay so option click registers
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {busy ? (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400"
            aria-hidden
          />
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-stone-600">{t('addressHint')}</p>
      {error ? (
        <p className="mt-1.5 text-xs text-red-700 dark:text-red-400" role="status">
          {error}
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-stone-200 bg-card py-1 shadow-lift"
        >
          {results.map((item) => (
            <li key={item.place_id} role="option" aria-selected={false}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-stone-800',
                  'hover:bg-mosque-50 focus-visible:bg-mosque-50 focus-visible:outline-none',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
              >
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-mosque-700" aria-hidden />
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !busy && query.trim().length >= 3 && results.length === 0 && !error ? (
        <p className="mt-1.5 text-xs text-stone-600" role="status">
          {t('addressSearchEmpty')}
        </p>
      ) : null}
    </div>
  );
}
