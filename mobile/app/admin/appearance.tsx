import { useEffect, useState } from "react";
import { useMe } from "@/api/auth";
import { Backgrounds, errorDetail, useBackgrounds, useUpdateBackgrounds } from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Note, Muted } from "@/components/ui";

const PAGES = ["home", "teams", "tournaments", "match", "admin", "auth"] as const;

export default function ManageAppearance() {
  const { data: me } = useMe();
  const { data: current, isLoading } = useBackgrounds();
  const update = useUpdateBackgrounds();
  const [bg, setBg] = useState<Backgrounds>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (current) setBg(current);
  }, [current]);

  if (me && me.role !== "SUPER_ADMIN")
    return <Screen><H1>Appearance</H1><Note tone="error">Super admins only.</Note></Screen>;

  const setUrl = (page: string, mode: "light" | "dark", url: string) =>
    setBg((b) => ({ ...b, [page]: { ...b[page], [mode]: url || null } }));

  const save = async () => {
    setMsg(null);
    try {
      await update.mutateAsync(bg);
      setMsg("Backgrounds saved ✓");
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <Screen>
      <H1>Appearance</H1>
      <Muted>Set a background image URL per page (light & dark). Use ultra-HD image URLs. Leave blank for none.</Muted>
      {isLoading && <Note>Loading…</Note>}
      {PAGES.map((p) => (
        <Card key={p}>
          <Muted>{p}</Muted>
          <Field label="Light-mode image URL" value={bg[p]?.light ?? ""} onChangeText={(v) => setUrl(p, "light", v)} placeholder="https://…" />
          <Field label="Dark-mode image URL" value={bg[p]?.dark ?? ""} onChangeText={(v) => setUrl(p, "dark", v)} placeholder="https://…" />
        </Card>
      ))}
      <Btn label={update.isPending ? "Saving…" : "Save backgrounds"} onPress={save} loading={update.isPending} />
      {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
    </Screen>
  );
}
