import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type { InningsScore, LiveScore, Match, Team } from "@/types";
import { teamName } from "@/hooks/useTeamMap";
import { palette, useTheme } from "@/theme";

function fmtDate(iso: string | null): string {
  if (!iso) return "TBD";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
}

export default function MatchCard({ match, teams }: { match: Match; teams: Map<number, Team> }) {
  const t = useTheme();
  const router = useRouter();
  const live = match.status === "LIVE";
  // Show scores for any match that's been played — live, at the break, or done.
  const showScore = ["LIVE", "INNINGS_BREAK", "COMPLETED"].includes(match.status);

  const { data: score } = useQuery({
    queryKey: ["live", match.id],
    queryFn: () => get<LiveScore>(`/public/matches/${match.id}/live`),
    enabled: showScore,
    refetchInterval: live ? 5000 : false,
  });

  const scoreFor = (teamId: number) => {
    const inn = score?.innings.find((i: InningsScore) => i.batting_team_id === teamId);
    return inn ? { runs: `${inn.runs}/${inn.wickets}`, overs: `${inn.overs} ov` } : null;
  };

  const starting = match.starting_soon && match.status === "SCHEDULED";

  return (
    <Pressable
      onPress={() => router.push(`/match/${match.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.statusRow}>
          {(live || starting) && <View style={styles.dot} />}
          <Text style={[styles.status, { color: live || starting ? palette.red : t.muted }]}>
            {starting ? "STARTING" : match.status.replace("_", " ")}
          </Text>
        </View>
        <Text style={{ color: t.muted, fontSize: 12 }}>{match.overs_limit} ov</Text>
      </View>

      <TeamRow t={t} name={teamName(teams, match.team_a_id)} logo={teams.get(match.team_a_id)?.logo_url ?? null} score={scoreFor(match.team_a_id)} winner={match.winner_team_id === match.team_a_id} />
      <Text style={[styles.vs, { color: t.muted }]}>vs</Text>
      <TeamRow t={t} name={teamName(teams, match.team_b_id)} logo={teams.get(match.team_b_id)?.logo_url ?? null} score={scoreFor(match.team_b_id)} winner={match.winner_team_id === match.team_b_id} />

      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Text style={{ color: t.muted, fontSize: 12 }}>📅 {fmtDate(match.scheduled_at)}</Text>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600" }}>
          {match.result_text ?? (live ? "In progress →" : "")}
        </Text>
      </View>
    </Pressable>
  );
}

function TeamRow({
  t, name, logo, score, winner,
}: {
  t: ReturnType<typeof useTheme>; name: string; logo: string | null;
  score: { runs: string; overs: string } | null; winner: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: t.primary }]}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{name.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text numberOfLines={1} style={{ color: winner ? t.primary : t.text, fontWeight: winner ? "900" : "700", fontSize: 16 }}>
          {name}
        </Text>
        {winner && <Text style={{ fontSize: 14 }}>🏆</Text>}
      </View>
      {score && (
        <Text style={{ color: t.text, fontWeight: "900", fontSize: 18 }}>
          {score.runs} <Text style={{ color: t.muted, fontSize: 12, fontWeight: "600" }}>{score.overs}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red },
  status: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  vs: { fontSize: 12, marginVertical: 3, marginLeft: 42 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
});
