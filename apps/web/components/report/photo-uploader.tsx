'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MAX_REPORT_PHOTOS } from '@prizren/shared-types';
import { RemoteImage } from '@/components/remote-image';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUploader({
  files,
  error,
  onFiles,
}: {
  files: File[];
  error?: string;
  onFiles: (files: File[], error?: string) => void;
}) {
  const t = useTranslations('ReportFlow');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);

  useEffect(() => {
    const next = files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    setPreviews(next);
    return () => {
      next.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [files]);

  const applyFiles = useCallback(
    (incoming: FileList | File[] | null, replace = false) => {
      const next = incoming ? Array.from(incoming) : [];
      const merged = replace ? next : [...files, ...next];
      if (merged.length === 0) {
        onFiles([]);
        return;
      }
      if (merged.length > MAX_REPORT_PHOTOS) {
        onFiles(files, t('photoMaxError'));
        return;
      }
      for (const file of next) {
        if (!ACCEPT.split(',').includes(file.type)) {
          onFiles(files, t('photoTypeError'));
          return;
        }
        if (file.size > MAX_BYTES) {
          onFiles(files, t('photoSizeError'));
          return;
        }
      }
      onFiles(merged);
    },
    [files, onFiles, t],
  );

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    applyFiles(e.target.files, files.length === 0);
    e.target.value = '';
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    applyFiles(e.dataTransfer.files, files.length === 0);
  }

  function removeAt(index: number) {
    onFiles(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id="report-photo"
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={onInputChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'report-photo-error' : 'report-photo-hint'}
      />

      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="relative overflow-hidden rounded-lg border border-border"
            >
              <RemoteImage
                src={item.url}
                alt={t('photoPreviewAlt')}
                className="h-36 w-full object-cover"
              />
              <Button
                type="button"
                variant="icon"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => removeAt(index)}
                aria-label={t('photoRemove')}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={t('photoDropTitle')}
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
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-12 text-center transition duration-fast ease-product',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            dragging
              ? 'border-primary bg-muted'
              : 'border-border bg-muted/60 hover:border-primary/60 hover:bg-card',
          )}
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary shadow-sm">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{t('photoDropTitle')}</p>
            <p id="report-photo-hint" className="mt-1 text-xs text-muted-foreground">
              {t('photoHint')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mosque-800">
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {t('photoCamera')}
          </span>
        </div>
      )}

      {files.length > 0 && files.length < MAX_REPORT_PHOTOS ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {t('photoAdd')}
        </Button>
      ) : null}

      <FieldError id="report-photo-error" message={error} />
    </div>
  );
}
