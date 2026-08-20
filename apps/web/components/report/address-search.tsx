'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, MapPinned, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FieldError } from '@/components/ui/field-error';
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
  const tCommon = useTranslations('Common');
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

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

  const listOpen = open && results.length > 0;
  const activeId = listOpen && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!listOpen) {
        if (results.length > 0) setOpen(true);
        return;
      }
      setActiveIndex((i) => (i + 1) % results.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!listOpen) {
        if (results.length > 0) setOpen(true);
        return;
      }
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      return;
    }

    if (!listOpen) return;

    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    }
  }

  return (
    <div className="relative">
      <Label htmlFor="report-address-search">{t('addressLabel')}</Label>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="report-address-search"
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-busy={busy || undefined}
          aria-describedby={
            error ? 'report-address-error report-address-hint' : 'report-address-hint'
          }
          placeholder={t('addressPlaceholder')}
          className="mt-0 pl-9 pr-9"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {busy ? (
          <>
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
            <span className="sr-only">{tCommon('loading')}</span>
          </>
        ) : null}
      </div>
      <p id="report-address-hint" className="mt-1.5 text-xs text-muted-foreground">
        {t('addressHint')}
      </p>
      <FieldError id="report-address-error" message={error ?? undefined} />

      {listOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lift"
        >
          {results.map((item, index) => (
            <li key={item.place_id} role="presentation">
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex min-h-11 w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-foreground',
                  'hover:bg-muted',
                  index === activeIndex && 'bg-muted',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(item)}
              >
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="line-clamp-2">{item.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !busy && query.trim().length >= 3 && results.length === 0 && !error ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {t('addressSearchEmpty')}
        </p>
      ) : null}
    </div>
  );
}
