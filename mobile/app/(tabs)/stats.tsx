import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useLeaderboards, type LeaderRow } from "@/api/hooks";
import { Loading, Empty } from "@/components/States";
import { palette, useTheme } from "@/theme";

function Row({ row, rank, unit, onPress }: { row: LeaderRow; rank: number; unit: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ width: 18, textAlign: "center", fontWeight: "800", color: rank === 1 ? t.primary : t.muted }}>{rank}</Text>
      {row.photo_url ? (
        <Image source={{ uri: row.photo_url }} style={{ width: 34, height: 34, borderRadius: 17 }} />
      ) : (
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.pitch, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{row.name.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontWeight: "700" }}>{row.name}</Text>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 12 }}>{row.team_name} · {row.matches} match{row.matches === 1 ? "" : "es"}</Text>
      </View>
      <Text style={{ color: t.primary, fontWeight: "900", fontSize: 18 }}>{row.value}<Text style={{ color: t.muted, fontSize: 11, fontWeight: "600" }}> {unit}</Text></Text>
    </Pressable>
  );
}

function Board({ title, unit, rows, onOpen }: { title: string; unit: string; rows: LeaderRow[]; onOpen: (id: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={{ color: t.muted }}>No data yet.</Text>
      ) : (
        rows.map((r, i) => <Row key={r.player_id} row={r} rank={i + 1} unit={unit} onPress={() => onOpen(r.player_id)} />)
      )}
    </View>
  );
}

export default function Stats() {
  const { data, isLoading } = useLeaderboards();
  const t = useTheme();
  const router = useRouter();

  if (isLoading) return <Loading />;
  const empty = !data || (!data.top_run_scorers.length && !data.top_wicket_takers.length);
  if (empty) return <Empty message="No player stats yet — they appear once matches are scored." />;

  const open = (id: number) => router.push(`/player/${id}`);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <Board title="⭐ MVP (impact)" unit="pts" rows={data!.mvps} onOpen={open} />
      <Board title="🏏 Most runs" unit="runs" rows={data!.top_run_scorers} onOpen={open} />
      <Board title="🔴 Most wickets" unit="wkts" rows={data!.top_wicket_takers} onOpen={open} />
    </ScrollView>
  );
}
