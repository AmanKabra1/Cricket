import { useState, type ChangeEvent } from "react";
import { uploadImage, type UploadCategory } from "@/api/admin";

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

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    </div>
  );
}
