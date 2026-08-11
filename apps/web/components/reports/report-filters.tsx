'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { getPriorityLabel, getStatusLabel, REPORT_PRIORITIES, REPORT_STATUSES } from '@/lib/labels';
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

  function patch(partial: Partial<ReportsFilterState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="reports-search" className="sr-only">
          {t('search')}
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
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

        <div>
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
              disabled={nearbyBusy}
            >
              {nearbyBusy ? t('searching') : t('nearMe')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
