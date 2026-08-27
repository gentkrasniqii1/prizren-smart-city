import type { Area } from 'react-easy-crop';

/** Square output sent to `PATCH /users/me/avatar`. Cloudinary has no fixed size; 512 keeps the file small and sharp in circular avatars. */
export const AVATAR_CROP_OUTPUT_PX = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('image load failed')));
    image.src = src;
  });
}

export async function cropImageToJpegBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_CROP_OUTPUT_PX;
  canvas.height = AVATAR_CROP_OUTPUT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas');
  }

  const sx = Math.max(0, Math.round(pixelCrop.x));
  const sy = Math.max(0, Math.round(pixelCrop.y));
  const sw = Math.min(image.naturalWidth - sx, Math.round(pixelCrop.width));
  const sh = Math.min(image.naturalHeight - sy, Math.round(pixelCrop.height));
  if (sw <= 0 || sh <= 0) {
    throw new Error('empty crop');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, AVATAR_CROP_OUTPUT_PX, AVATAR_CROP_OUTPUT_PX);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob'))),
      'image/jpeg',
      0.92,
    );
  });
}
