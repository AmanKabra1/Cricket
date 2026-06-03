import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { logout, useMe } from "@/api/auth";
import { useTheme } from "@/theme";

export default function Account() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();

  const doLogout = async () => {
    await logout();
    await qc.invalidateQueries();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 20 }}>
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
              <TouchableOpacity onPress={() => router.push("/admin")} style={{ marginTop: 20, backgroundColor: t.primary, padding: 14, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Manage (teams, matches, tournaments…)</Text>
              </TouchableOpacity>
              <Text style={{ color: t.muted, marginTop: 12 }}>
                Or open a live match from Home and tap “Score this match”.
              </Text>
            </>
          )}

          <TouchableOpacity onPress={doLogout} style={{ marginTop: 24, borderColor: t.border, borderWidth: 1, padding: 14, borderRadius: 10, alignItems: "center" }}>
            <Text style={{ color: t.text, fontWeight: "700" }}>Log out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Admin</Text>
          <Text style={{ color: t.muted, marginBottom: 20 }}>Sign in to score matches. Spectators don’t need an account.</Text>
          <TouchableOpacity onPress={() => router.push("/login")} style={{ backgroundColor: t.primary, padding: 14, borderRadius: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
