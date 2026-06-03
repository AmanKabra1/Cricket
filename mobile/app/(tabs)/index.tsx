import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDashboard } from "@/api/hooks";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import { Loading, Empty } from "@/components/States";
import { palette, useTheme } from "@/theme";
import type { Match } from "@/types";

export default function Dashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboard();
  const teams = useTeamMap();
  const t = useTheme();

  if (isLoading) return <Loading label="Loading matches…" />;
  if (isError || !data) return <Empty message="Couldn't load matches. Pull to retry." />;

  const empty = !data.live.length && !data.upcoming.length && !data.recent.length;

  const Section = ({ title, matches }: { title: string; matches: Match[] }) =>
    matches.length ? (
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.heading, { color: t.text }]}>{title}</Text>
        {matches.map((m) => <MatchCard key={m.id} match={m} teams={teams} />)}
      </View>
    ) : null;

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={t.primary} />}
    >
      {/* Hero — mirrors the web dashboard. */}
      <View style={[styles.hero, { backgroundColor: palette.pitch }]}>
        <Text style={styles.heroTitle}>Local cricket, live.</Text>
        <Text style={styles.heroSub}>Ball-by-ball scores, scorecards & commentary for your local matches.</Text>
        <View style={styles.stats}>
          <Stat n={data.live.length} label="LIVE" />
          <Stat n={data.upcoming.length} label="UPCOMING" />
          <Stat n={data.recent.length} label="COMPLETED" />
        </View>
      </View>

      {empty ? (
        <Empty message="No matches yet. Live scores will appear here." />
      ) : (
        <>
          <Section title="🔴 Live now" matches={data.live} />
          <Section title="Upcoming" matches={data.upcoming} />
          <Section title="Recent results" matches={data.recent} />
        </>
      )}
    </ScrollView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  hero: { borderRadius: 16, padding: 18, marginBottom: 16 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.85)", marginTop: 4 },
  stats: { flexDirection: "row", gap: 24, marginTop: 16 },
  statN: { color: "#fff", fontSize: 22, fontWeight: "900" },
  statL: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
});
