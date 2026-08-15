import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { BANNER_RATIO, BANNER_RECOMMENDED } from "@/lib/banners";

/**
 * Drag-and-zoom cropper locked to the 2.45:1 hero ratio. Exports a JPEG blob
 * at 1200x490 so every device renders the same framing without stretching.
 */
export function BannerCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [url, setUrl] = useState<string>("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const start = (x: number, y: number) => {
    drag.current = { x, y, ox: offset.x, oy: offset.y };
  };
  const move = (x: number, y: number) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (x - d.x), y: d.oy + (y - d.y) });
  };
  const end = () => {
    drag.current = null;
  };

  const crop = useCallback(() => {
    const box = boxRef.current;
    if (!img || !box) return;
    const boxW = box.clientWidth;
    const boxH = box.clientHeight;
    // Cover-fit scale, then user zoom.
    const base = Math.max(boxW / img.width, boxH / img.height);
    const scale = base * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const left = (boxW - drawW) / 2 + offset.x;
    const top = (boxH - drawH) / 2 + offset.y;

    const out = document.createElement("canvas");
    out.width = BANNER_RECOMMENDED.width;
    out.height = BANNER_RECOMMENDED.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const k = out.width / boxW;
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(img, left * k, top * k, drawW * k, drawH * k);
    out.toBlob((blob) => blob && onCropped(blob), "image/jpeg", 0.9);
  }, [img, zoom, offset, onCropped]);

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className="relative w-full cursor-grab overflow-hidden rounded-xl border border-border bg-muted active:cursor-grabbing"
        style={{ aspectRatio: String(BANNER_RATIO) }}
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={(e) => start(e.touches[0]!.clientX, e.touches[0]!.clientY)}
        onTouchMove={(e) => move(e.touches[0]!.clientX, e.touches[0]!.clientY)}
        onTouchEnd={end}
      >
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
              width: img && boxRef.current
                ? `${img.width * Math.max(boxRef.current.clientWidth / img.width, boxRef.current.clientHeight / img.height)}px`
                : "100%",
            }}
          />
        ) : null}
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={crop}>
          Use this crop
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
