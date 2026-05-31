import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useDashboard } from "@/api/hooks";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import { Loading, Empty } from "@/components/States";
import { useTheme } from "@/theme";
import type { Match } from "@/types";

export default function Dashboard() {
  const { data, isLoading, isError } = useDashboard();
  const teams = useTeamMap();
  const t = useTheme();

  if (isLoading) return <Loading label="Loading matches…" />;
  if (isError || !data) return <Empty message="Couldn't load matches. Pull to retry." />;

  const empty = !data.live.length && !data.upcoming.length && !data.recent.length;
  if (empty) return <Empty message="No matches yet. Live scores will appear here." />;

  const Section = ({ title, matches }: { title: string; matches: Match[] }) =>
    matches.length ? (
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.heading, { color: t.text }]}>{title}</Text>
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} teams={teams} />
        ))}
      </View>
    ) : null;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Section title="🔴 Live now" matches={data.live} />
      <Section title="Upcoming" matches={data.upcoming} />
      <Section title="Recent results" matches={data.recent} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  heading: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
});
