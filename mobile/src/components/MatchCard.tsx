import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Match, Team } from "@/types";
import { teamName } from "@/hooks/useTeamMap";
import { palette, useTheme } from "@/theme";

export default function MatchCard({ match, teams }: { match: Match; teams: Map<number, Team> }) {
  const t = useTheme();
  const router = useRouter();
  const live = match.status === "LIVE";

  return (
    <Pressable
      onPress={() => router.push(`/match/${match.id}`)}
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.statusRow}>
          {live && <View style={styles.dot} />}
          <Text style={[styles.status, { color: live ? palette.red : t.muted }]}>
            {match.status.replace("_", " ")}
          </Text>
        </View>
        <Text style={{ color: t.muted, fontSize: 12 }}>{match.overs_limit} ov</Text>
      </View>

      <Text style={[styles.team, { color: t.text }]}>{teamName(teams, match.team_a_id)}</Text>
      <Text style={[styles.vs, { color: t.muted }]}>vs</Text>
      <Text style={[styles.team, { color: t.text }]}>{teamName(teams, match.team_b_id)}</Text>

      {match.result_text ? (
        <Text style={[styles.result, { color: t.primary }]}>{match.result_text}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red },
  status: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  team: { fontSize: 16, fontWeight: "700" },
  vs: { fontSize: 12, marginVertical: 2 },
  result: { marginTop: 10, fontWeight: "600" },
});
