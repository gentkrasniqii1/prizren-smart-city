'use client';

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RemoteImage } from '@/components/remote-image';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUploader({
  preview,
  error,
  onFile,
  onClear,
}: {
  preview: string | null;
  error?: string;
  onFile: (file: File | null, error?: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('ReportFlow');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const applyFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onFile(null);
        return;
      }
      if (!ACCEPT.split(',').includes(file.type)) {
        onFile(null, t('photoTypeError'));
        return;
      }
      if (file.size > MAX_BYTES) {
        onFile(null, t('photoSizeError'));
        return;
      }
      onFile(file);
    },
    [onFile, t],
  );

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    applyFile(e.target.files?.[0] ?? null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    applyFile(e.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id="report-photo"
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={onInputChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'report-photo-error' : 'report-photo-hint'}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-stone-200">
          <RemoteImage
            src={preview}
            alt={t('photoPreviewAlt')}
            className="max-h-72 w-full object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              {t('photoReplace')}
            </Button>
            <Button
              type="button"
              variant="icon"
              size="sm"
              onClick={onClear}
              aria-label={t('photoRemove')}
              className="bg-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center transition',
            dragging
              ? 'border-mosque-500 bg-mosque-50'
              : 'border-stone-300 bg-stone-50 hover:border-mosque-400 hover:bg-white',
          )}
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-mosque-800 shadow-sm">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-stone-900">{t('photoDropTitle')}</p>
            <p id="report-photo-hint" className="mt-1 text-xs text-stone-500">
              {t('photoHint')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mosque-800">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {t('photoCamera')}
          </span>
        </div>
      )}

      <FieldError id="report-photo-error" message={error} />
    </div>
  );
}
