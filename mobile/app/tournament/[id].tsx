import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTournaments } from "@/api/hooks";
import { useStandings, useTournamentMatches } from "@/api/admin";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import { Loading } from "@/components/States";
import { useTheme } from "@/theme";
import type { Match } from "@/types";

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tid = Number(id);
  const t = useTheme();
  const teams = useTeamMap();
  const { data: tournaments } = useTournaments();
  const { data: standings, isLoading } = useStandings(tid);
  const { data: matches } = useTournamentMatches(tid);
  const tournament = tournaments?.find((x) => x.id === tid);

  if (isLoading) return <Loading />;

  const live = (matches ?? []).filter((m: Match) => m.status === "LIVE" || m.status === "INNINGS_BREAK");
  const upcoming = (matches ?? []).filter((m: Match) => m.status === "SCHEDULED");
  const recent = (matches ?? []).filter((m: Match) => m.status === "COMPLETED" || m.status === "ABANDONED");

  const Section = ({ title, items }: { title: string; items: Match[] }) =>
    items.length ? (
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.h2, { color: t.text }]}>{title}</Text>
        {items.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)}
      </View>
    ) : null;

  return (
    <ScrollView style={{ backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.h1, { color: t.text }]}>{tournament?.name ?? "Tournament"}</Text>
      <Text style={{ color: t.muted, marginBottom: 16 }}>
        {tournament?.format.replace("_", " ")}{tournament ? ` · ${tournament.status}` : ""}
      </Text>

      {/* Points table */}
      <Text style={[styles.h2, { color: t.text }]}>Points table</Text>
      <View style={[styles.table, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[styles.tr, { borderBottomColor: t.border }]}>
          <Text style={[styles.th, styles.team, { color: t.muted }]}>Team</Text>
          {["P", "W", "L", "T", "Pts", "NRR"].map((h) => (
            <Text key={h} style={[styles.th, styles.cell, { color: t.muted }]}>{h}</Text>
          ))}
        </View>
        {(standings ?? []).map((r) => (
          <View key={r.team_id} style={[styles.tr, { borderBottomColor: t.border }]}>
            <Text style={[styles.team, { color: t.text, fontWeight: "600" }]} numberOfLines={1}>{r.team_name}</Text>
            <Text style={[styles.cell, { color: t.text }]}>{r.played}</Text>
            <Text style={[styles.cell, { color: t.text }]}>{r.won}</Text>
            <Text style={[styles.cell, { color: t.text }]}>{r.lost}</Text>
            <Text style={[styles.cell, { color: t.text }]}>{r.tied}</Text>
            <Text style={[styles.cell, { color: t.primary, fontWeight: "800" }]}>{r.points}</Text>
            <Text style={[styles.cell, { color: t.text }]}>{r.net_run_rate > 0 ? "+" : ""}{r.net_run_rate}</Text>
          </View>
        ))}
        {!standings?.length && <Text style={{ color: t.muted, padding: 12 }}>No standings yet.</Text>}
      </View>

      {/* Fixtures grouped like the dashboard */}
      <Text style={[styles.h2, { color: t.text, marginTop: 8 }]}>Fixtures</Text>
      {!matches?.length ? (
        <Text style={{ color: t.muted }}>No fixtures generated yet.</Text>
      ) : (
        <>
          <Section title="🔴 Live now" items={live} />
          <Section title="Upcoming" items={upcoming} />
          <Section title="Recent results" items={recent} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: "800" },
  h2: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  table: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 8 },
  th: { fontSize: 12, fontWeight: "700" },
  team: { flex: 1, fontSize: 13 },
  cell: { width: 34, textAlign: "center", fontSize: 13 },
});
