import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, ErrorText, Modal } from './ui';

const STAGE = 280;
const CROP = 240;
const PAD = (STAGE - CROP) / 2;
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Pan = { x: number; y: number };

function minScale(img: HTMLImageElement) {
  return Math.max(CROP / img.naturalWidth, CROP / img.naturalHeight);
}

function clampPan(img: HTMLImageElement, pan: Pan, zoom: number): Pan {
  const scale = minScale(img) * zoom;
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const baseX = (STAGE - drawnW) / 2;
  const baseY = (STAGE - drawnH) / 2;
  const minX = PAD + CROP - drawnW - baseX;
  const maxX = PAD - baseX;
  const minY = PAD + CROP - drawnH - baseY;
  const maxY = PAD - baseY;
  return {
    x: Math.min(maxX, Math.max(minX, pan.x)),
    y: Math.min(maxY, Math.max(minY, pan.y)),
  };
}

function cropToBlob(img: HTMLImageElement, pan: Pan, zoom: number): Promise<Blob> {
  const scale = minScale(img) * zoom;
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const x = (STAGE - drawnW) / 2 + pan.x;
  const y = (STAGE - drawnH) / 2 + pan.y;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not crop photo'));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    (PAD - x) / scale,
    (PAD - y) / scale,
    CROP / scale,
    CROP / scale,
    0,
    0,
    OUTPUT,
    OUTPUT,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop photo'))),
      'image/jpeg',
      0.9,
    );
  });
}

export function PhotoCropModal({
  open,
  src,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  src: string | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; pan: Pan } | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    setReady(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setError('');
  }, [src]);

  function applyPan(next: Pan) {
    const img = imgRef.current;
    setPan(img ? clampPan(img, next, zoom) : next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pan };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    applyPan({
      x: drag.current.pan.x + (e.clientX - drag.current.x),
      y: drag.current.pan.y + (e.clientY - drag.current.y),
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img) return;
    setError('');
    try {
      onConfirm(await cropToBlob(img, pan, zoom));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop photo');
    }
  }

  const img = imgRef.current;
  const scale = img && ready ? minScale(img) * zoom : 1;
  const drawnW = img ? img.naturalWidth * scale : 0;
  const drawnH = img ? img.naturalHeight * scale : 0;

  return (
    <Modal open={open} title="Crop photo" onClose={busy ? () => undefined : onClose} zClass="z-[60]">
      <p className="text-sm text-[var(--muted)] mb-4">
        Drag to reposition and zoom so the face sits in the circle — this is how it appears in the app.
      </p>
      <div
        className="relative mx-auto overflow-hidden rounded-xl bg-[#111827] touch-none select-none"
        style={{ width: STAGE, height: STAGE, cursor: busy ? 'default' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={() => {
              setReady(true);
              setPan({ x: 0, y: 0 });
            }}
            className="absolute max-w-none pointer-events-none"
            style={{
              visibility: ready ? 'visible' : 'hidden',
              width: drawnW || undefined,
              height: drawnH || undefined,
              left: ready ? (STAGE - drawnW) / 2 + pan.x : 0,
              top: ready ? (STAGE - drawnH) / 2 + pan.y : 0,
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle ${CROP / 2}px at ${STAGE / 2}px ${STAGE / 2}px, transparent ${CROP / 2 - 1}px, rgba(0,0,0,0.55) ${CROP / 2}px)`,
          }}
        />
        <div
          className="absolute rounded-full border-2 border-white/90 pointer-events-none"
          style={{ width: CROP, height: CROP, left: PAD, top: PAD }}
        />
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm text-[var(--muted)]">
        Zoom
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={busy || !ready}
          className="flex-1 accent-[var(--brand)]"
          onChange={(e) => {
            const next = Number(e.target.value);
            setZoom(next);
            const current = imgRef.current;
            if (current) setPan((p) => clampPan(current, p, next));
          }}
        />
      </label>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2 mt-4">
        <Button type="button" disabled={busy || !ready} onClick={() => void confirm()}>
          {busy ? 'Uploading…' : 'Use photo'}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
