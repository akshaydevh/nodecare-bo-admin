import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, ErrorText, Modal } from './ui';

type Pan = { x: number; y: number };

const STAGE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export type CropPreset = {
  label: string;
  aspect: number;
  outWidth: number;
  outHeight: number;
};

export const CMS_CROP_PRESETS: Record<string, CropPreset> = {
  carousel: { label: 'Carousel 1.91:1', aspect: 1.91, outWidth: 1200, outHeight: 630 },
  featured_card: { label: 'Featured 3:4', aspect: 3 / 4, outWidth: 720, outHeight: 960 },
  service_shortcut: { label: 'Shortcut 1:1', aspect: 1, outWidth: 600, outHeight: 600 },
  service_shortcut_wide: { label: 'Wide 2:1', aspect: 2, outWidth: 1200, outHeight: 600 },
  specialty_icon: { label: 'Icon 1:1', aspect: 1, outWidth: 256, outHeight: 256 },
  testimonial_portrait: { label: 'Portrait 1:1', aspect: 1, outWidth: 512, outHeight: 512 },
};

function cropBox(aspect: number) {
  const maxW = STAGE - 40;
  const maxH = STAGE - 40;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h, padX: (STAGE - w) / 2, padY: (STAGE - h) / 2 };
}

function minScale(img: HTMLImageElement, cropW: number, cropH: number) {
  return Math.max(cropW / img.naturalWidth, cropH / img.naturalHeight);
}

function clampPan(img: HTMLImageElement, pan: Pan, zoom: number, cropW: number, cropH: number, padX: number, padY: number): Pan {
  const scale = minScale(img, cropW, cropH) * zoom;
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const baseX = (STAGE - drawnW) / 2;
  const baseY = (STAGE - drawnH) / 2;
  const minX = padX + cropW - drawnW - baseX;
  const maxX = padX - baseX;
  const minY = padY + cropH - drawnH - baseY;
  const maxY = padY - baseY;
  return {
    x: Math.min(maxX, Math.max(minX, pan.x)),
    y: Math.min(maxY, Math.max(minY, pan.y)),
  };
}

function cropToBlob(
  img: HTMLImageElement,
  pan: Pan,
  zoom: number,
  preset: CropPreset,
  cropW: number,
  cropH: number,
  padX: number,
  padY: number,
): Promise<Blob> {
  const scale = minScale(img, cropW, cropH) * zoom;
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const x = (STAGE - drawnW) / 2 + pan.x;
  const y = (STAGE - drawnH) / 2 + pan.y;
  const canvas = document.createElement('canvas');
  canvas.width = preset.outWidth;
  canvas.height = preset.outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not crop image'));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    (padX - x) / scale,
    (padY - y) / scale,
    cropW / scale,
    cropH / scale,
    0,
    0,
    preset.outWidth,
    preset.outHeight,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop image'))),
      'image/jpeg',
      0.92,
    );
  });
}

export function CmsImageCropModal({
  open,
  src,
  presetKey,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  src: string | null;
  presetKey: keyof typeof CMS_CROP_PRESETS;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const preset = CMS_CROP_PRESETS[presetKey];
  const box = cropBox(preset.aspect);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; pan: Pan } | null>(null);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setError('');
      setReady(false);
    }
  }, [open, src]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setPan(clampPan(img, { x: 0, y: 0 }, 1, box.w, box.h, box.padX, box.padY));
    setReady(true);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pan };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || !imgRef.current) return;
    const next = {
      x: drag.current.pan.x + (e.clientX - drag.current.x),
      y: drag.current.pan.y + (e.clientY - drag.current.y),
    };
    setPan(clampPan(imgRef.current, next, zoom, box.w, box.h, box.padX, box.padY));
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img || !ready) return;
    try {
      setError('');
      const blob = await cropToBlob(img, pan, zoom, preset, box.w, box.h, box.padX, box.padY);
      onConfirm(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed');
    }
  }

  const scale = imgRef.current ? minScale(imgRef.current, box.w, box.h) * zoom : 1;

  return (
    <Modal open={open} onClose={onClose} title={`Crop — ${preset.label}`} size="lg">
      {!src ? (
        <ErrorText>No image selected</ErrorText>
      ) : (
        <div className="space-y-4">
          <div
            className="relative mx-auto overflow-hidden rounded-lg bg-[#111] touch-none select-none"
            style={{ width: STAGE, height: STAGE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={{
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            />
            <div
              className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ left: box.padX, top: box.padY, width: box.w, height: box.h }}
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            Zoom
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(z);
                if (imgRef.current) {
                  setPan(clampPan(imgRef.current, pan, z, box.w, box.h, box.padX, box.padY));
                }
              }}
              className="flex-1"
            />
          </label>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void confirm()} disabled={busy || !ready}>
              {busy ? 'Uploading…' : 'Use image'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
