import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { logout, useMe } from "@/api/auth";
import { Btn, Chip } from "@/components/ui";
import { useTheme, useThemeMode, type ThemeMode } from "@/theme";

const MODES: { key: ThemeMode; label: string }[] = [
  { key: "system", label: "⚙️ System" },
  { key: "light", label: "☀️ Light" },
  { key: "dark", label: "🌙 Dark" },
];

export default function Account() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const { mode, setMode } = useThemeMode();

  const doLogout = async () => {
    await logout();
    await qc.invalidateQueries();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 20 }}>
      {isLoading ? (
        <Text style={{ color: t.muted }}>Loading…</Text>
      ) : me ? (
        <View>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>{me.full_name}</Text>
          <Text style={{ color: t.muted, marginTop: 2 }}>{me.email}</Text>
          <View style={{ alignSelf: "flex-start", backgroundColor: t.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
              {me.role === "SUPER_ADMIN" ? "👑 Super Admin" : me.role === "MATCH_ADMIN" ? "🛡️ Match Admin" : "Viewer"}
            </Text>
          </View>

          {me.role !== "PUBLIC" && (
            <>
              <View style={{ marginTop: 20 }}>
                <Btn label="Manage (teams, matches, tournaments…)" onPress={() => router.push("/admin")} />
              </View>
              <Text style={{ color: t.muted, marginTop: 12 }}>
                Or open a live match from Home and tap “Score this match”.
              </Text>
            </>
          )}

          <View style={{ marginTop: 24 }}>
            <Btn label="Log out" tone="ghost" onPress={doLogout} />
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Admin</Text>
          <Text style={{ color: t.muted, marginBottom: 20 }}>Sign in to score matches. Spectators don’t need an account.</Text>
          <Btn label="Sign in" onPress={() => router.push("/login")} />
        </View>
      )}

      {/* Appearance — light/dark/system, persisted (web parity). */}
      <View style={{ marginTop: 28 }}>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 8 }}>APPEARANCE</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {MODES.map((m) => (
            <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => setMode(m.key)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
