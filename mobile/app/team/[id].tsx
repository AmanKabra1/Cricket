import { FlatList, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTeam } from "@/api/hooks";
import { Loading } from "@/components/States";
import { useTheme } from "@/theme";

export default function TeamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTeam(Number(id));
  const t = useTheme();

  if (isLoading || !data) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: data.name }} />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <Text style={[styles.heading, { color: t.text }]}>
            Squad ({data.players.length})
          </Text>
        }
        data={data.players}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.num, { color: t.muted }]}>{item.jersey_number ?? "–"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: t.text }]}>
                {item.name}
                {data.captain_id === item.id ? "  (C)" : ""}
              </Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {item.role.replace("_", " ")} · {item.batting_style.replace("_", " ")}
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  num: { width: 24, textAlign: "center", fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "700" },
});
