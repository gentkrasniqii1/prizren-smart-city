'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/field';
import { cropImageToJpegBlob } from '@/lib/crop-image';

export function AvatarCropDialog({
  imageSrc,
  busy,
  onCancel,
  onConfirm,
  onCropError,
}: {
  imageSrc: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
  onCropError: () => void;
}) {
  const t = useTranslations('Account');
  const tCommon = useTranslations('Common');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }, [imageSrc]);

  const onCropComplete = useCallback((_cropped: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const locked = busy || cropping;

  async function confirm() {
    if (!imageSrc || !area || locked) return;
    setCropping(true);
    try {
      const blob = await cropImageToJpegBlob(imageSrc, area);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      await onConfirm(file);
    } catch {
      onCropError();
    } finally {
      setCropping(false);
    }
  }

  return (
    <Dialog
      open={Boolean(imageSrc)}
      onOpenChange={(open) => {
        if (!open && !locked) onCancel();
      }}
    >
      <DialogContent
        className="max-w-md overflow-hidden"
        onPointerDownOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('avatarCropTitle')}</DialogTitle>
          <DialogDescription>{t('avatarCropHint')}</DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(18rem,50vh)] w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={1}
              maxZoom={3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div>
          <Label htmlFor="avatar-crop-zoom">{t('avatarCropZoom')}</Label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={locked}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 h-11 w-full accent-primary"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={locked}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" loading={locked} disabled={!area} onClick={() => void confirm()}>
            {t('avatarCropConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
