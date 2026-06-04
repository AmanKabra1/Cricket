import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

/** Crop the source image to the given pixel area and return a JPEG File. */
async function cropToFile(src: string, area: Area, name: string): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  // Cap the output so logos/photos stay small and fast.
  const max = 512;
  const scale = Math.min(1, max / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
  return new File([blob], name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Interactive crop + zoom modal (square aspect), like the mobile picker's editor.
 * Calls onDone with a cropped JPEG File, or onCancel.
 */
export default function ImageCropper({
  src,
  fileName,
  onDone,
  onCancel,
}: {
  src: string;
  fileName: string;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const save = async () => {
    if (!area) return;
    setBusy(true);
    try {
      onDone(await cropToFile(src, area, fileName));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl p-4" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-bold">Crop image</h3>
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs muted">Zoom</span>
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="flex-1"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={save} disabled={busy || !area}>
            {busy ? "Saving…" : "Use photo"}
          </button>
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
