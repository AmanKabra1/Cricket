import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { usePlayerStats } from "@/api/hooks";
import { Loading } from "@/components/States";
import { palette, useTheme, type Theme } from "@/theme";

function Cell({ t, label, value }: { t: Theme; label: string; value: string | number }) {
  return (
    <View style={[styles.cell, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 10, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = usePlayerStats(Number(id));
  const t = useTheme();

  if (isLoading || !data) return <Loading />;
  const { player: p, batting: b, bowling: w, fielding: f } = data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: p.name }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
        {p.photo_url ? (
          <Image source={{ uri: p.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.fallback, { backgroundColor: palette.pitch }]}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 20 }}>{p.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>{p.name}</Text>
            {p.jersey_number != null && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: t.primary + "22" }}>
                <Text style={{ color: t.primary, fontWeight: "800", fontSize: 12 }}>👕 #{p.jersey_number}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: t.muted }}>
            {p.role.replace("_", " ")} · {p.batting_style.replace("_", " ")}
            {p.bowling_style && p.bowling_style !== "None" ? ` · ${p.bowling_style}` : ""}
          </Text>
        </View>
      </View>

      <Text style={[styles.h2, { color: t.text }]}>🏏 Batting</Text>
      <View style={styles.grid}>
        <Cell t={t} label="Mat" value={b.matches} />
        <Cell t={t} label="Inns" value={b.innings} />
        <Cell t={t} label="Runs" value={b.runs} />
        <Cell t={t} label="HS" value={b.high_score} />
        <Cell t={t} label="Avg" value={b.average ?? "—"} />
        <Cell t={t} label="SR" value={b.strike_rate} />
        <Cell t={t} label="NO" value={b.not_outs} />
        <Cell t={t} label="50s" value={b.fifties} />
        <Cell t={t} label="100s" value={b.hundreds} />
        <Cell t={t} label="4s" value={b.fours} />
        <Cell t={t} label="6s" value={b.sixes} />
        <Cell t={t} label="Balls" value={b.balls} />
      </View>

      <Text style={[styles.h2, { color: t.text }]}>🔴 Bowling</Text>
      <View style={styles.grid}>
        <Cell t={t} label="Overs" value={w.overs} />
        <Cell t={t} label="Runs" value={w.runs_conceded} />
        <Cell t={t} label="Wkts" value={w.wickets} />
        <Cell t={t} label="Best" value={w.best_wickets} />
        <Cell t={t} label="Econ" value={w.economy} />
        <Cell t={t} label="Avg" value={w.average ?? "—"} />
      </View>

      <Text style={[styles.h2, { color: t.text }]}>🧤 Fielding</Text>
      <View style={styles.grid}>
        <Cell t={t} label="Catches" value={f.catches} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 64, height: 64, borderRadius: 18 },
  fallback: { alignItems: "center", justifyContent: "center" },
  h2: { fontSize: 16, fontWeight: "800", marginTop: 8, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  cell: { width: "30.7%", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
});
