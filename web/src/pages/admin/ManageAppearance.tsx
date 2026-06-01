import { useEffect, useState } from "react";
import { useBackgrounds } from "@/api/hooks";
import { useUpdateBackgrounds } from "@/api/admin";
import ImageUpload from "@/components/ImageUpload";
import { BG_PAGES, DEFAULT_BACKGROUNDS, type BgConfig } from "@/lib/backgrounds";

const LABELS: Record<string, string> = {
  home: "Home / Dashboard",
  teams: "Teams",
  tournaments: "Tournaments",
  match: "Match Centre",
  admin: "Manage (admin)",
  auth: "Login",
};

export default function ManageAppearance() {
  const { data } = useBackgrounds();
  const save = useUpdateBackgrounds();
  const [cfg, setCfg] = useState<BgConfig>({});
  const [msg, setMsg] = useState<string | null>(null);

  // Seed the editor from saved config (falling back to the HD defaults).
  useEffect(() => {
    const merged: BgConfig = {};
    for (const p of BG_PAGES) merged[p] = { ...DEFAULT_BACKGROUNDS[p], ...(data?.[p] ?? {}) };
    setCfg(merged);
  }, [data]);

  const setUrl = (page: string, mode: "light" | "dark", url: string) =>
    setCfg((c) => ({ ...c, [page]: { ...c[page], [mode]: url } }));

  const onSave = async () => {
    setMsg(null);
    await save.mutateAsync(cfg);
    setMsg("✓ Backgrounds saved. They apply across the site immediately.");
  };

  const resetDefaults = () => setCfg({ ...DEFAULT_BACKGROUNDS });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Backgrounds</h2>
          <p className="text-sm muted">
            A background image per tab, separate for light &amp; dark. Paste an HD image URL
            or upload one. A readability overlay keeps text legible in both modes.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {BG_PAGES.map((page) => (
          <div key={page} className="card-surface p-4">
            <h3 className="mb-3 font-semibold">{LABELS[page]}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload
                category="match_image"
                label="Light mode image"
                value={cfg[page]?.light ?? ""}
                onChange={(u) => setUrl(page, "light", u)}
              />
              <ImageUpload
                category="match_image"
                label="Dark mode image"
                value={cfg[page]?.dark ?? ""}
                onChange={(u) => setUrl(page, "dark", u)}
              />
            </div>
          </div>
        ))}
      </div>

      {msg && <p className="mt-3 text-sm text-pitch-600">{msg}</p>}
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save backgrounds"}
        </button>
        <button className="btn-ghost" onClick={resetDefaults}>Reset to defaults</button>
      </div>
    </div>
  );
}
