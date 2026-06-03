import { useState } from "react";
import { Text, View } from "react-native";
import { useMe } from "@/api/auth";
import {
  errorDetail, useCreateUser, useDeleteUser, useSetUserActive, useSetUserRole, useTestEmail, useUsers,
} from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Chip, Note, Muted } from "@/components/ui";
import { useTheme } from "@/theme";
import type { User } from "@/types";

const ROLES = ["MATCH_ADMIN", "SUPER_ADMIN", "PUBLIC"];

export default function ManageUsers() {
  const t = useTheme();
  const { data: me } = useMe();
  const { data: users, isLoading, refetch, isFetching } = useUsers();
  const create = useCreateUser();
  const setRole = useSetUserRole();
  const setActive = useSetUserActive();
  const del = useDeleteUser();
  const testEmail = useTestEmail();

  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "MATCH_ADMIN" });
  const [msg, setMsg] = useState<string | null>(null);

  if (me && me.role !== "SUPER_ADMIN")
    return <Screen><H1>Admins</H1><Note tone="error">Super admins only.</Note></Screen>;

  const submit = async () => {
    setMsg(null);
    try {
      await create.mutateAsync(form);
      setMsg(`Created ${form.email} ✓ (they're emailed their login)`);
      setForm({ full_name: "", email: "", password: "", role: "MATCH_ADMIN" });
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <H1>Admins</H1>
      <Card>
        <Muted>Create admin</Muted>
        <Field label="Full name" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
        <Field label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" />
        <View style={{ position: "relative" }}>
          <Field label="Password (min 8)" value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secure={!showPw} />
          <Text style={{ position: "absolute", right: 10, top: 30, fontSize: 18 }} onPress={() => setShowPw((s) => !s)}>{showPw ? "🙈" : "👁️"}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
          {["MATCH_ADMIN", "SUPER_ADMIN"].map((r) => <Chip key={r} label={r.replace("_", " ")} selected={form.role === r} onPress={() => setForm({ ...form, role: r })} />)}
        </View>
        <Btn label={create.isPending ? "Creating…" : "Create admin"} onPress={submit} loading={create.isPending} />
        {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
        <View style={{ marginTop: 10 }}>
          <Btn tone="ghost" loading={testEmail.isPending} label={testEmail.isPending ? "Sending…" : "Send test email to me"} onPress={async () => { try { const r = await testEmail.mutateAsync(); setMsg(r.detail); } catch (e) { setMsg(errorDetail(e)); } }} />
        </View>
      </Card>

      <H1>Users ({users?.length ?? 0})</H1>
      {isLoading && <Note>Loading…</Note>}
      {(users ?? []).map((u: User) => (
        <Card key={u.id}>
          <Text style={{ color: t.text, fontWeight: "700" }}>{u.full_name} {!u.is_active && <Text style={{ color: "#ef4444", fontSize: 12 }}>(disabled)</Text>}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>{u.email} · {u.role.replace("_", " ")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {ROLES.filter((r) => r !== u.role).map((r) => <Chip key={r} label={`→ ${r.replace("_", " ")}`} selected={false} loading={setRole.isPending && setRole.variables?.id === u.id && setRole.variables?.role === r} onPress={() => setRole.mutate({ id: u.id, role: r })} />)}
            <Chip label={u.is_active ? "Disable" : "Enable"} selected={false} loading={setActive.isPending && setActive.variables?.id === u.id} onPress={() => setActive.mutate({ id: u.id, is_active: !u.is_active })} />
            {u.id !== me?.id && <Chip label="Delete" selected={false} loading={del.isPending && del.variables === u.id} onPress={() => del.mutate(u.id)} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
