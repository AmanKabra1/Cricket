import { FlatList, Image, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTeam } from "@/api/hooks";
import { Loading } from "@/components/States";
import { palette, useTheme } from "@/theme";

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTeam(Number(id));
  const t = useTheme();

  if (isLoading || !data) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <Stack.Screen options={{ title: data.name }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View>
            {/* Header: logo/initials + name + city · coach */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
              {data.logo_url ? (
                <Image source={{ uri: data.logo_url }} style={styles.logo} />
              ) : (
                <View style={[styles.logo, styles.logoFallback, { backgroundColor: palette.pitch }]}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>{data.name.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>{data.name}</Text>
                <Text style={{ color: t.muted }}>
                  {data.city ?? "—"}{data.coach ? ` · Coach: ${data.coach}` : ""}
                </Text>
              </View>
            </View>
            <Text style={[styles.heading, { color: t.text }]}>Squad ({data.players.length})</Text>
          </View>
        }
        data={data.players}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
            {item.photo_url ? (
              <Image source={{ uri: item.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.logoFallback, { backgroundColor: palette.pitch }]}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.num, { color: t.muted }]}>{item.jersey_number ?? "–"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {item.name}
                {data.captain_id === item.id ? <Text style={{ color: t.primary }}> C</Text> : null}
                {data.vice_captain_id === item.id ? <Text style={{ color: t.primary }}> VC</Text> : null}
                {data.wicket_keeper_id === item.id ? <Text style={{ color: t.primary }}> WK</Text> : null}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {item.role.replace("_", " ")} · {item.batting_style.replace("_", " ")}
                {item.bowling_style && item.bowling_style !== "None" ? ` · ${item.bowling_style}` : ""}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  logo: { width: 64, height: 64, borderRadius: 16 },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  num: { width: 22, textAlign: "center", fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "700" },
});
