import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTournaments, useTournamentLeaderboards, type LeaderRow } from "@/api/hooks";
import { useStandings, useTournamentMatches } from "@/api/admin";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import { FollowButton } from "@/components/FollowButton";
import { Bracket } from "@/components/Bracket";
import { Loading } from "@/components/States";
import { palette, useTheme } from "@/theme";
import type { Match } from "@/types";

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tid = Number(id);
  const t = useTheme();
  const router = useRouter();
  const teams = useTeamMap();
  const { data: tournaments } = useTournaments();
  const { data: standings, isLoading } = useStandings(tid);
  const { data: matches } = useTournamentMatches(tid);
  const { data: lb } = useTournamentLeaderboards(tid);
  const tournament = tournaments?.find((x) => x.id === tid);
  const mvp = lb?.mvps?.[0];

  const MiniBoard = ({ title, unit, rows }: { title: string; unit: string; rows: LeaderRow[] }) =>
    rows.length ? (
      <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <Text style={{ color: t.text, fontWeight: "800", marginBottom: 4 }}>{title}</Text>
        {rows.slice(0, 5).map((r, i) => (
          <Pressable key={r.player_id} onPress={() => router.push(`/player/${r.player_id}`)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
            <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}><Text style={{ color: t.muted }}>{i + 1}  </Text>{r.name}</Text>
            <Text style={{ color: t.primary, fontWeight: "800" }}>{r.value}<Text style={{ color: t.muted, fontSize: 11 }}> {unit}</Text></Text>
          </Pressable>
        ))}
      </View>
    ) : null;

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
      <Text style={{ color: t.muted, marginBottom: 12 }}>
        {tournament?.format.replace("_", " ")}{tournament ? ` · ${tournament.status}` : ""}
      </Text>
      <View style={{ marginBottom: 16 }}><FollowButton tournamentId={tid} /></View>

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

      {/* MVP + leaderboards */}
      {mvp && (
        <View style={{ backgroundColor: palette.pitch, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800" }}>⭐ TOURNAMENT MVP</Text>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 2 }}>{mvp.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{mvp.team_name} · {mvp.value} impact pts · {mvp.matches} match{mvp.matches === 1 ? "" : "es"}</Text>
        </View>
      )}
      {lb && (lb.top_run_scorers.length > 0 || lb.top_wicket_takers.length > 0) && (
        <>
          <Text style={[styles.h2, { color: t.text }]}>Leaderboards</Text>
          <MiniBoard title="⭐ MVP" unit="pts" rows={lb.mvps} />
          <MiniBoard title="🏏 Most runs" unit="runs" rows={lb.top_run_scorers} />
          <MiniBoard title="🔴 Most wickets" unit="wkts" rows={lb.top_wicket_takers} />
        </>
      )}

      {tournament?.format === "KNOCKOUT" && (matches?.length ?? 0) > 0 && (
        <>
          <Text style={[styles.h2, { color: t.text, marginTop: 8 }]}>Bracket</Text>
          <View style={{ marginBottom: 14 }}>
            <Bracket matches={matches ?? []} teams={teams} />
          </View>
        </>
      )}

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
