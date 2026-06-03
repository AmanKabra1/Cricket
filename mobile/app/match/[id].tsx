import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAnalytics, useCommentary, useLiveScore, useMatch, usePrediction, useScorecard } from "@/api/hooks";
import { useMe } from "@/api/auth";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { Loading, Empty } from "@/components/States";
import { Btn } from "@/components/ui";
import { palette, useTheme } from "@/theme";
import type { BatterCard, BowlerCard, CommentaryItem, InningsCard, InningsScore, OverPoint, Team } from "@/types";

const TABS = ["Live", "Scorecard", "Commentary", "Prediction", "Analytics"] as const;
type Tab = (typeof TABS)[number];

export default function MatchCentre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const [tab, setTab] = useState<Tab>("Live");
  const t = useTheme();
  const router = useRouter();
  const teams = useTeamMap();
  const { data: match, isLoading } = useMatch(matchId);
  const { data: me } = useMe();
  useLiveSocket(matchId);

  if (isLoading || !match) return <Loading />;

  const canScore = me && me.role !== "PUBLIC" && match.status !== "COMPLETED" && match.status !== "ABANDONED";

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={[styles.title, { color: t.text }]}>
        {teamName(teams, match.team_a_id)} vs {teamName(teams, match.team_b_id)}
      </Text>
      <Text style={{ color: t.muted, marginBottom: 14 }}>
        {match.overs_limit} overs · {match.status.replace("_", " ")}
      </Text>

      {canScore && (
        <View style={{ marginBottom: 14 }}>
          <Btn label="Score this match" onPress={() => router.push(`/score/${matchId}`)} />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabs, { borderColor: t.border }]}
        contentContainerStyle={{ alignItems: "center" }}
      >
        {TABS.map((x) => (
          <Pressable key={x} onPress={() => setTab(x)} style={styles.tabBtn}>
            <Text style={{ color: tab === x ? t.primary : t.muted, fontWeight: "700" }}>{x}</Text>
            {tab === x && <View style={[styles.underline, { backgroundColor: t.primary }]} />}
          </Pressable>
        ))}
      </ScrollView>

      {tab === "Live" && <LiveTab matchId={matchId} teams={teams} />}
      {tab === "Scorecard" && <ScorecardTab matchId={matchId} teams={teams} />}
      {tab === "Commentary" && <CommentaryTab matchId={matchId} />}
      {tab === "Prediction" && <PredictionTab matchId={matchId} teams={teams} />}
      {tab === "Analytics" && <AnalyticsTab matchId={matchId} teams={teams} />}
    </ScrollView>
  );
}

function LiveTab({ matchId, teams }: { matchId: number; teams: Map<number, Team> }) {
  const { data, isLoading } = useLiveScore(matchId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data?.innings.length) return <Empty message="Match not started." />;
  return (
    <View>
      {data.innings.map((inn: InningsScore) => (
        <View key={inn.innings_id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.muted }}>{teamName(teams, inn.batting_team_id)}</Text>
          <Text style={[styles.score, { color: t.text }]}>
            {inn.runs}/{inn.wickets} <Text style={{ color: t.muted, fontSize: 16 }}>({inn.overs})</Text>
          </Text>
          <View style={styles.metaRow}>
            <Text style={{ color: t.muted }}>CRR {inn.run_rate.toFixed(2)}</Text>
            {inn.required_run_rate != null && (
              <Text style={{ color: palette.amber }}>RRR {inn.required_run_rate.toFixed(2)}</Text>
            )}
            {inn.target != null && <Text style={{ color: t.muted }}>Target {inn.target}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function ScorecardTab({ matchId, teams }: { matchId: number; teams: Map<number, Team> }) {
  const { data, isLoading } = useScorecard(matchId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data?.innings.length) return <Empty message="No scorecard yet." />;
  return (
    <View>
      {data.innings.map((inn: InningsCard) => (
        <View key={inn.innings_id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>
            {teamName(teams, inn.batting_team_id)} — {inn.runs}/{inn.wickets} ({inn.overs})
          </Text>
          {inn.batting.map((b: BatterCard) => (
            <View key={b.player_id} style={styles.statRow}>
              <Text style={[styles.statName, { color: t.text }]}>
                {b.name}
                {b.is_out ? "" : " *"}
              </Text>
              <Text style={{ color: t.muted }}>
                {b.runs} ({b.balls}) · SR {b.strike_rate.toFixed(0)}
              </Text>
            </View>
          ))}
          {inn.bowling.length > 0 && (
            <Text style={[styles.subhead, { color: t.muted }]}>Bowling</Text>
          )}
          {inn.bowling.map((b: BowlerCard) => (
            <View key={b.player_id} style={styles.statRow}>
              <Text style={[styles.statName, { color: t.text }]}>{b.name}</Text>
              <Text style={{ color: t.muted }}>
                {b.overs}–{b.runs_conceded}–{b.wickets} · Econ {b.economy.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function CommentaryTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useCommentary(matchId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data?.length) return <Empty message="No commentary yet." />;
  return (
    <View>
      {data.map((c: CommentaryItem, i: number) => (
        <View key={i} style={[styles.commentRow, { borderColor: t.border }]}>
          <Text style={[styles.over, { color: c.is_wicket ? palette.red : t.primary }]}>
            {c.over}.{c.ball}
          </Text>
          <Text style={{ color: t.text, flex: 1 }}>{c.text}</Text>
        </View>
      ))}
    </View>
  );
}

function PredictionTab({ matchId, teams }: { matchId: number; teams: Map<number, Team> }) {
  const { data, isLoading } = usePrediction(matchId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data || data.available === false)
    return <Empty message={data?.message || "Prediction available once the match is live."} />;

  const batPct = Math.round((data.batting_win_probability ?? 0.5) * 100);
  const bowlPct = 100 - batPct;
  const batName = data.batting_team_id ? teamName(teams, data.batting_team_id) : "Batting";
  const bowlName = data.bowling_team_id ? teamName(teams, data.bowling_team_id) : "Bowling";

  return (
    <View>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>Win probability</Text>
        <View style={styles.probBar}>
          <View style={{ width: `${batPct}%`, backgroundColor: t.primary }} />
          <View style={{ width: `${bowlPct}%`, backgroundColor: palette.amber }} />
        </View>
        <View style={styles.metaRow}>
          <Text style={{ color: t.primary, fontWeight: "800" }}>{batName} {batPct}%</Text>
          <Text style={{ color: palette.amber, fontWeight: "800" }}>{bowlName} {bowlPct}%</Text>
        </View>
        {data.projected_score != null && (
          <Text style={{ color: t.muted, marginTop: 10 }}>Projected score: <Text style={{ color: t.text, fontWeight: "800" }}>{data.projected_score}</Text></Text>
        )}
      </View>

      {!!data.insight && (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>🤖 AI insight</Text>
          <Text style={{ color: t.text, lineHeight: 20 }}>{data.insight}</Text>
        </View>
      )}

      {!!data.key_moments?.length && (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Key moments</Text>
          {data.key_moments.map((m, i) => (
            <Text key={i} style={{ color: t.muted, paddingVertical: 2 }}>• {m}</Text>
          ))}
        </View>
      )}
      {!!data.model && <Text style={{ color: t.muted, fontSize: 11, textAlign: "center" }}>Model: {data.model}</Text>}
    </View>
  );
}

function AnalyticsTab({ matchId, teams }: { matchId: number; teams: Map<number, Team> }) {
  const { data, isLoading } = useAnalytics(matchId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data?.innings.length) return <Empty message="No analytics yet." />;

  return (
    <View>
      {data.innings.map((inn) => {
        const max = Math.max(1, ...inn.overs.map((o) => o.runs));
        return (
          <View key={inn.innings_number} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>{teamName(teams, inn.batting_team_id)} — runs per over</Text>
            <View style={styles.manhattan}>
              {inn.overs.map((o: OverPoint) => (
                <View key={o.over} style={styles.barCol}>
                  <View style={[styles.bar, { height: 8 + (o.runs / max) * 100, backgroundColor: o.wickets ? palette.red : t.primary }]} />
                  <Text style={{ color: t.muted, fontSize: 9 }}>{o.over}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>Red bars = a wicket fell that over.</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800" },
  tabs: { flexGrow: 0, borderBottomWidth: 1, marginBottom: 14 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  underline: { height: 2, width: "100%", marginTop: 8 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
  score: { fontSize: 30, fontWeight: "900", marginVertical: 4 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  statName: { fontWeight: "600" },
  subhead: { marginTop: 10, marginBottom: 4, fontWeight: "700", textTransform: "uppercase", fontSize: 12 },
  commentRow: { flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  over: { fontWeight: "800", width: 44 },
  probBar: { flexDirection: "row", height: 18, borderRadius: 9, overflow: "hidden", marginVertical: 8 },
  manhattan: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 3, minHeight: 120, marginTop: 8 },
  barCol: { alignItems: "center", width: 18 },
  bar: { width: 12, borderRadius: 3 },
});
