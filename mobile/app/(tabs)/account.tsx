import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { logout, useMe } from "@/api/auth";
import { Btn } from "@/components/ui";
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
    </ScrollView>
  );
}
