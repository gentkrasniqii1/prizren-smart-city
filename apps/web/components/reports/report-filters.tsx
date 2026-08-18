'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { getPriorityLabel, getStatusLabel, REPORT_PRIORITIES, REPORT_STATUSES } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/request';

export type ReportsFilterState = {
  query: string;
  status: string;
  categoryId: string;
  priority: string;
  from: string;
  to: string;
  nearbyKm: string;
};

type CategoryOption = { id: string; name: string };

function countActiveAdvanced(value: ReportsFilterState) {
  let n = 0;
  if (value.status) n += 1;
  if (value.categoryId) n += 1;
  if (value.priority) n += 1;
  if (value.from) n += 1;
  if (value.to) n += 1;
  if (value.nearbyKm.trim()) n += 1;
  return n;
}

export function ReportFilters({
  value,
  onChange,
  categories,
  locale,
  nearbyBusy,
  onNearby,
}: {
  value: ReportsFilterState;
  onChange: (next: ReportsFilterState) => void;
  categories: CategoryOption[];
  locale: AppLocale;
  nearbyBusy: boolean;
  onNearby: () => void;
}) {
  const t = useTranslations('Reports');
  const panelId = useId();
  const activeAdvanced = useMemo(() => countActiveAdvanced(value), [value]);
  // Open by default when URL/state already has advanced filters applied
  const [open, setOpen] = useState(() => countActiveAdvanced(value) > 0);

  function patch(partial: Partial<ReportsFilterState>) {
    onChange({ ...value, ...partial });
  }

  function clearAdvanced() {
    onChange({
      ...value,
      status: '',
      categoryId: '',
      priority: '',
      from: '',
      to: '',
      nearbyKm: '',
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="reports-search" className="sr-only">
          {t('search')}
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="reports-search"
            value={value.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder={t('searchPlaceholder')}
            className="mt-0 pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-10 flex-1 sm:flex-none"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {open ? t('hideFilters') : t('showFilters')}
          {activeAdvanced > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {activeAdvanced}
            </span>
          ) : null}
          <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} aria-hidden />
        </Button>
        {activeAdvanced > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
            {t('clearFilters')}
          </Button>
        ) : null}
      </div>

      <div id={panelId} className={cn(!open && 'hidden', 'lg:block')}>
        <div className="mb-2 hidden items-center justify-between lg:flex">
          <p className="text-sm font-medium text-foreground">{t('filtersHeading')}</p>
          {activeAdvanced > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
              {t('clearFilters')}
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <Label htmlFor="reports-status">{t('status')}</Label>
            <Select
              id="reports-status"
              value={value.status}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="">{t('all')}</option>
              {REPORT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {getStatusLabel(s, locale)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="reports-category">{t('category')}</Label>
            <Select
              id="reports-category"
              value={value.categoryId}
              onChange={(e) => patch({ categoryId: e.target.value })}
            >
              <option value="">{t('all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="reports-priority">{t('priority')}</Label>
            <Select
              id="reports-priority"
              value={value.priority}
              onChange={(e) => patch({ priority: e.target.value })}
            >
              <option value="">{t('all')}</option>
              {REPORT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {getPriorityLabel(p, locale)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="reports-from">{t('from')}</Label>
            <Input
              id="reports-from"
              type="date"
              value={value.from}
              onChange={(e) => patch({ from: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="reports-to">{t('to')}</Label>
            <Input
              id="reports-to"
              type="date"
              value={value.to}
              onChange={(e) => patch({ to: e.target.value })}
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="reports-nearby">{t('nearby')}</Label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <Input
                id="reports-nearby"
                type="number"
                min={0.1}
                step={0.1}
                value={value.nearbyKm}
                onChange={(e) => patch({ nearbyKm: e.target.value })}
                placeholder="2"
                className="mt-0"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full shrink-0 sm:w-auto"
                onClick={onNearby}
                loading={nearbyBusy}
              >
                {nearbyBusy ? t('searching') : t('nearMe')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
