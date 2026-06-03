import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTeams } from "@/api/hooks";
import { Loading, Empty } from "@/components/States";
import { useTheme } from "@/theme";

export default function Teams() {
  const { data, isLoading } = useTeams();
  const t = useTheme();
  const router = useRouter();

  if (isLoading) return <Loading />;
  if (!data?.length) return <Empty message="No teams registered yet." />;

  return (
    <FlatList
      style={{ backgroundColor: "transparent" }}
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/team/${item.id}`)}
          style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <View style={[styles.badge, { backgroundColor: t.primary }]}>
            <Text style={styles.badgeText}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
            <Text style={{ color: t.muted }}>{item.city ?? "—"}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontWeight: "800" },
  name: { fontSize: 16, fontWeight: "700" },
});
