import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTournaments } from "@/api/hooks";
import { Loading, Empty } from "@/components/States";
import { useTheme } from "@/theme";

export default function Tournaments() {
  const { data, isLoading } = useTournaments();
  const t = useTheme();
  const router = useRouter();

  if (isLoading) return <Loading />;
  if (!data?.length) return <Empty message="No tournaments yet." />;

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/tournament/${item.id}`)}
          style={({ pressed }) => [styles.card, { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={styles.row}>
            <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
            <View style={[styles.tag, { backgroundColor: t.primary }]}>
              <Text style={styles.tagText}>{item.format.replace("_", " ")}</Text>
            </View>
          </View>
          <Text style={{ color: t.muted, marginTop: 4 }}>Status: {item.status} ›</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
