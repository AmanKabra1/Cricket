import { useState, type ChangeEvent } from "react";
import { uploadImage, type UploadCategory } from "@/api/admin";
import ImageCropper from "@/components/ImageCropper";

/**
 * Pick an image → upload to object storage → return its public URL.
 * Falls back to pasting a URL directly (handy when storage isn't running, e.g.
 * the SQLite-only local mode without MinIO).
 */
export default function ImageUpload({
  category,
  value,
  onChange,
  label = "Image",
}: {
  category: UploadCategory;
  value: string | undefined;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Local object URL + name of the file being cropped before upload.
  const [cropping, setCropping] = useState<{ src: string; name: string } | null>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setCropping({ src: URL.createObjectURL(file), name: file.name });
    e.target.value = ""; // allow re-selecting the same file
  }

  async function uploadCropped(file: File) {
    if (cropping) URL.revokeObjectURL(cropping.src);
    setCropping(null);
    setBusy(true);
    setErr(null);
    try {
      const url = await uploadImage(file, category);
      onChange(url);
    } catch {
      setErr("Upload failed (storage may be off). Paste an image URL instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold muted">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-lg border text-xs muted" style={{ borderColor: "var(--border)" }}>
            none
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input type="file" accept="image/*" onChange={onFile} disabled={busy} className="block w-full text-sm" />
          <input
            className="input text-sm"
            placeholder="…or paste an image URL"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
      {busy && <p className="mt-1 text-xs muted">Uploading…</p>}
      {err && <p className="mt-1 text-xs text-amber-500">{err}</p>}
      {cropping && (
        <ImageCropper
          src={cropping.src}
          fileName={cropping.name}
          onDone={uploadCropped}
          onCancel={() => { URL.revokeObjectURL(cropping.src); setCropping(null); }}
        />
      )}
    </div>
  );
}
