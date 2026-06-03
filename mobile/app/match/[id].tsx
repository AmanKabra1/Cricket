import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAnalytics, useCommentary, useLiveScore, useMatch, usePrediction, useScorecard, useTeam } from "@/api/hooks";
import { useMe } from "@/api/auth";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { Loading, Empty } from "@/components/States";
import Celebration from "@/components/Celebration";
import { Btn } from "@/components/ui";
import { palette, useTheme } from "@/theme";
import type { BatterCard, BowlerCard, CommentaryItem, InningsCard, InningsScore, Match, OverPoint, Team } from "@/types";

const TABS = ["Live", "Scorecard", "Commentary", "Playing XI", "Analytics", "AI Prediction"] as const;
type Tab = (typeof TABS)[number];

const oversToBalls = (o: string) => {
  const [a, b] = o.split(".").map(Number);
  return (a || 0) * 6 + (b || 0);
};

function PlayerAvatar({ name, photo, size = 28 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.pitch, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.36 }}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export default function MatchCentre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const [tab, setTab] = useState<Tab>("Live");
  const t = useTheme();
  const router = useRouter();
  const teams = useTeamMap();
  const { data: match, isLoading } = useMatch(matchId);
  const { data: live } = useLiveScore(matchId);
  const { data: me } = useMe();
  useLiveSocket(matchId);

  if (isLoading || !match) return <Loading />;

  const isLive = match.status === "LIVE";
  const completed = match.status === "COMPLETED" || match.status === "ABANDONED";
  const winnerId = match.winner_team_id;
  const canScore = me && me.role !== "PUBLIC" && !completed && (match as any).approved !== false;

  // Chase tracker — "need R off B balls" while a target is being chased.
  const chase = live?.innings.find((i) => !i.is_closed && i.target != null);
  const chaseInfo = chase && chase.target != null ? {
    runs: Math.max(0, chase.target - chase.runs),
    balls: Math.max(0, match.overs_limit * 6 - oversToBalls(chase.overs)),
    team: teamName(teams, chase.batting_team_id),
  } : null;

  return (
    <ScrollView style={{ backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16 }}>
      {/* Confetti + flowers when a finished match with a winner is opened. */}
      <Celebration run={match.status === "COMPLETED" && !!winnerId} />

      {isLive ? (
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>LIVE</Text></View>
      ) : (
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 2 }}>{match.status.replace("_", " ")}</Text>
      )}
      <Text style={[styles.title, { color: t.text }]}>
        {teamName(teams, match.team_a_id)}{winnerId === match.team_a_id ? " 🏆" : ""}
        <Text style={{ color: t.muted }}> vs </Text>
        {teamName(teams, match.team_b_id)}{winnerId === match.team_b_id ? " 🏆" : ""}
      </Text>
      <Text style={{ color: t.muted, marginBottom: match.result_text ? 4 : 14 }}>
        {match.overs_limit} overs
        {match.toss_winner_id ? ` · ${teamName(teams, match.toss_winner_id)} won the toss & chose to ${(match.toss_decision || "").toLowerCase()}` : ""}
      </Text>
      {match.result_text && (
        <Text style={{ color: t.primary, fontWeight: "800", marginBottom: 14 }}>🏆 {match.result_text}</Text>
      )}

      {canScore && (
        <View style={{ marginBottom: 14 }}>
          <Btn label="Score this match" onPress={() => router.push(`/score/${matchId}`)} />
        </View>
      )}

      {/* Chase tracker — above every tab while a target is chased. */}
      {chaseInfo && (
        <View style={{ backgroundColor: t.primary + "1a", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: t.primary, fontWeight: "700", textAlign: "center" }}>
            {chaseInfo.team} need {chaseInfo.runs} run{chaseInfo.runs === 1 ? "" : "s"} from {chaseInfo.balls} ball{chaseInfo.balls === 1 ? "" : "s"} to win
          </Text>
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
            <Text style={{ color: tab === x ? t.primary : t.muted, fontWeight: "700" }}>
              {x === "Live" && completed ? "Summary" : x}
            </Text>
            {tab === x && <View style={[styles.underline, { backgroundColor: t.primary }]} />}
          </Pressable>
        ))}
      </ScrollView>

      {tab === "Live" && <LiveTab matchId={matchId} teams={teams} />}
      {tab === "Scorecard" && <ScorecardTab matchId={matchId} teams={teams} />}
      {tab === "Commentary" && <CommentaryTab matchId={matchId} />}
      {tab === "Playing XI" && <PlayingXITab match={match} />}
      {tab === "Analytics" && <AnalyticsTab matchId={matchId} teams={teams} />}
      {tab === "AI Prediction" && <PredictionTab matchId={matchId} teams={teams} />}
    </ScrollView>
  );
}

function PlayingXITab({ match }: { match: Match }) {
  return (
    <View>
      <Squad teamId={match.team_a_id} />
      <Squad teamId={match.team_b_id} />
    </View>
  );
}

function Squad({ teamId }: { teamId: number }) {
  const { data, isLoading } = useTeam(teamId);
  const t = useTheme();
  if (isLoading) return <Loading />;
  if (!data) return null;
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.cardTitle, { color: t.text }]}>{data.name}</Text>
      {data.players.map((p) => (
        <View key={p.id} style={styles.statRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <PlayerAvatar name={p.name} photo={p.photo_url} size={26} />
            <Text style={{ color: t.muted, width: 22, textAlign: "center" }}>{p.jersey_number ?? "–"}</Text>
            <Text style={{ color: t.text, fontWeight: "600" }} numberOfLines={1}>
              {p.name}
              {data.captain_id === p.id ? <Text style={{ color: t.primary }}> C</Text> : null}
              {data.vice_captain_id === p.id ? <Text style={{ color: t.primary }}> VC</Text> : null}
              {data.wicket_keeper_id === p.id ? <Text style={{ color: t.primary }}> WK</Text> : null}
            </Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 12 }}>{p.role.replace("_", " ")}</Text>
        </View>
      ))}
    </View>
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

          {/* Batting */}
          <View style={[styles.cardHead, { backgroundColor: t.primary + "22" }]}>
            <Text style={[styles.hBat, { color: t.primary }]}>🏏 Batting</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>R</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>B</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>4s</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>6s</Text>
            <Text style={[styles.hSr, { color: t.primary }]}>SR</Text>
          </View>
          {inn.batting.map((b: BatterCard) => (
            <View key={b.player_id} style={[styles.cardRow, { borderBottomColor: t.border }]}>
              <View style={styles.hBatCell}>
                <PlayerAvatar name={b.name} photo={b.photo_url} size={24} />
                <Text style={{ color: t.text, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
                  {b.name}{!b.is_out ? <Text style={{ color: t.primary, fontSize: 11 }}>  not out</Text> : null}
                </Text>
              </View>
              <Text style={[styles.hNum, { color: t.text, fontWeight: "700" }]}>{b.runs}</Text>
              <Text style={[styles.hNum, { color: t.muted }]}>{b.balls}</Text>
              <Text style={[styles.hNum, { color: t.muted }]}>{b.fours}</Text>
              <Text style={[styles.hNum, { color: t.muted }]}>{b.sixes}</Text>
              <Text style={[styles.hSr, { color: t.muted }]}>{b.strike_rate.toFixed(1)}</Text>
            </View>
          ))}
          {!inn.batting.length && <Text style={{ color: t.muted, paddingVertical: 6 }}>Yet to bat.</Text>}

          {/* Bowling */}
          <View style={[styles.cardHead, { backgroundColor: t.primary + "22", marginTop: 10 }]}>
            <Text style={[styles.hBat, { color: t.primary }]}>🔴 Bowling</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>O</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>R</Text>
            <Text style={[styles.hNum, { color: t.primary }]}>W</Text>
            <Text style={[styles.hSr, { color: t.primary }]}>Econ</Text>
          </View>
          {inn.bowling.map((b: BowlerCard) => (
            <View key={b.player_id} style={[styles.cardRow, { borderBottomColor: t.border }]}>
              <View style={styles.hBatCell}>
                <PlayerAvatar name={b.name} photo={b.photo_url} size={24} />
                <Text style={{ color: t.text, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>{b.name}</Text>
              </View>
              <Text style={[styles.hNum, { color: t.muted }]}>{b.overs}</Text>
              <Text style={[styles.hNum, { color: t.muted }]}>{b.runs_conceded}</Text>
              <Text style={[styles.hNum, { color: t.text, fontWeight: "700" }]}>{b.wickets}</Text>
              <Text style={[styles.hSr, { color: t.muted }]}>{b.economy.toFixed(2)}</Text>
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
            <Text style={[styles.cardTitle, { color: t.text }]}>{teamName(teams, inn.batting_team_id)} — over by over</Text>

            <Text style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>Manhattan (runs per over)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.manhattan}>
                {inn.overs.map((o: OverPoint) => (
                  <View key={o.over} style={styles.barCol}>
                    <View style={[styles.bar, { height: 8 + (o.runs / max) * 100, backgroundColor: o.wickets ? palette.red : t.primary }]} />
                    <Text style={{ color: t.muted, fontSize: 9 }}>{o.over}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={{ color: t.muted, fontSize: 11, marginTop: 4 }}>Red bars = a wicket fell that over.</Text>

            {/* Worm — cumulative runs as a stepped area of dots/segments. */}
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 14, marginBottom: 4 }}>Worm (cumulative runs)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.worm}>
                {inn.overs.map((o: OverPoint) => {
                  const maxCum = Math.max(1, inn.overs[inn.overs.length - 1]?.cumulative ?? 1);
                  return (
                    <View key={o.over} style={styles.barCol}>
                      <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.pitchDark, marginBottom: (o.cumulative / maxCum) * 90 }} />
                      </View>
                      <Text style={{ color: t.muted, fontSize: 9 }}>{o.over}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
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
  manhattan: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 130, marginTop: 4 },
  worm: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 120, marginTop: 4 },
  barCol: { alignItems: "center", width: 22 },
  bar: { width: 12, borderRadius: 3 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: palette.red, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  cardHead: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1 },
  hBat: { flex: 1, fontWeight: "800", fontSize: 12 },
  hBatCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  hNum: { width: 30, textAlign: "center", fontSize: 12 },
  hSr: { width: 44, textAlign: "center", fontSize: 12 },
});
