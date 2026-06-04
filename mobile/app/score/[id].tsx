import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tap, success, warn } from "@/lib/haptics";
import { useMe } from "@/api/auth";
import { useLiveScore, useMatch, useScorecard, useTeam } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useTheme, type Theme } from "@/theme";
import type { BatterCard, InningsCard, InningsScore, Match, Player, Team } from "@/types";

const WICKET_TYPES = ["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET"];
const scoringKey = (matchId: number, inningsId: number) => `localscore:scoring:${matchId}:${inningsId}`;

// "o.b" overs string → total legal balls bowled.
function oversToBalls(overs: string): number {
  const [o, b] = overs.split(".").map(Number);
  return (o || 0) * 6 + (b || 0);
}

type Snapshot = {
  striker: number | null;
  nonStriker: number | null;
  bowler: number | null;
  lastOverBowler: number | null;
  dismissed: number[];
};

export default function Score() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const teams = useTeamMap();

  const { data: me, isLoading: meLoading } = useMe();
  const { data: match } = useMatch(matchId);
  const { data: live } = useLiveScore(matchId);
  const { data: scorecard } = useScorecard(matchId);
  const { data: teamA } = useTeam(match?.team_a_id ?? 0);
  const { data: teamB } = useTeam(match?.team_b_id ?? 0);

  const open = live?.innings.find((i: InningsScore) => !i.is_closed) ?? null;
  const openId = open?.innings_id ?? null;

  const [striker, setStriker] = useState<number | null>(null);
  const [nonStriker, setNonStriker] = useState<number | null>(null);
  const [bowler, setBowler] = useState<number | null>(null);
  const [wicketType, setWicketType] = useState(WICKET_TYPES[0]);
  const [runOutEnd, setRunOutEnd] = useState<"striker" | "non_striker">("striker");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [lastOverBowler, setLastOverBowler] = useState<number | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wicketOpen, setWicketOpen] = useState(false); // reveal the wicket-type panel

  // Restore on (re)entering an open innings: prefer the server's on-field state
  // (synced across web & app), else this device's last local picks. Resets the
  // wicket selector / undo history for a fresh innings. Runs once per innings.
  useEffect(() => {
    setWicketType(WICKET_TYPES[0]);
    setRunOutEnd("striker");
    setHistory([]);
    setWicketOpen(false);
    if (!openId) {
      setStriker(null); setNonStriker(null); setBowler(null);
      setLastOverBowler(null); setDismissed(new Set());
      return;
    }
    const srvS = open?.current_striker_id ?? null;
    const srvN = open?.current_non_striker_id ?? null;
    const srvB = open?.current_bowler_id ?? null;
    let cancelled = false;
    AsyncStorage.getItem(scoringKey(matchId, openId))
      .then((raw) => {
        if (cancelled) return;
        const s = raw ? JSON.parse(raw) : null;
        const useServer = !!(srvS || srvN || srvB);
        setStriker(useServer ? srvS : s?.striker ?? null);
        setNonStriker(useServer ? srvN : s?.nonStriker ?? null);
        setBowler(useServer ? srvB : s?.bowler ?? null);
        setLastOverBowler(s?.lastOverBowler ?? null);
        setDismissed(new Set(s?.dismissed ?? []));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, matchId]);

  // Persist this device's picks so they survive an app reload.
  useEffect(() => {
    if (!openId) return;
    AsyncStorage.setItem(
      scoringKey(matchId, openId),
      JSON.stringify({ striker, nonStriker, bowler, lastOverBowler, dismissed: [...dismissed] }),
    ).catch(() => {});
  }, [striker, nonStriker, bowler, lastOverBowler, dismissed, openId, matchId]);

  // Tell the server who's at the crease (shows a sent-in batter at 0*, syncs web).
  useEffect(() => {
    const mayScore = !!me && me.role !== "PUBLIC";
    if (!mayScore || !openId || !striker || !nonStriker || striker === nonStriker) return;
    api
      .post(`/matches/${matchId}/scoring/at-crease`, {
        striker_id: striker,
        non_striker_id: nonStriker,
        bowler_id: bowler ?? null,
      })
      .then(() => qc.invalidateQueries({ queryKey: ["scorecard", matchId] }))
      .catch(() => {});
  }, [striker, nonStriker, bowler, openId, matchId, me, qc]);

  // Out batters this innings (scorecard is_out + just-dismissed) — hidden from selectors.
  const outIds = useMemo(() => {
    const s = new Set<number>(dismissed);
    scorecard?.innings.forEach((inn: InningsCard) => {
      if (open && inn.innings_id === open.innings_id) {
        inn.batting.forEach((b: BatterCard) => { if (b.is_out) s.add(b.player_id); });
      }
    });
    return s;
  }, [scorecard, open?.innings_id, dismissed]);

  if (meLoading) return <Center t={t}>Loading…</Center>;
  if (!me || me.role === "PUBLIC") {
    return (
      <Center t={t}>
        <Text style={{ color: t.text, marginBottom: 12 }}>Sign in as an admin to score this match.</Text>
        <Btn t={t} label="Sign in" onPress={() => router.push("/login")} />
      </Center>
    );
  }
  if (!match) return <Center t={t}>Loading match…</Center>;

  const allBat: Player[] = open
    ? (teamA?.id === open.batting_team_id ? teamA?.players : teamB?.players) ?? []
    : [];
  const batPlayers = allBat.filter((p) => !outIds.has(p.id));
  const bowlPlayers: Player[] = open
    ? (teamA?.id === open.bowling_team_id ? teamA?.players : teamB?.players) ?? []
    : [];

  // Striker ≠ non-striker (hidden from each other); a bowler can't bowl two overs in a row.
  const strikerOptions = batPlayers.filter((p) => p.id !== nonStriker);
  const nonStrikerOptions = batPlayers.filter((p) => p.id !== striker);
  const bowlerOptions = bowlPlayers.filter((p) => p.id !== lastOverBowler);

  const ready = !!striker && !!nonStriker && !!bowler && striker !== nonStriker;
  const canScore = me.role === "SUPER_ADMIN" || (match.admin_ids ?? []).includes(me.id);
  const freeHit = !!live?.free_hit;
  const effectiveWicket = freeHit ? "RUN_OUT" : wicketType;
  const bothInningsDone = !open && (live?.innings.length ?? 0) >= 2;
  const matchOver = match.status === "COMPLETED" || bothInningsDone;
  const ballsLeft = open ? match.overs_limit * 6 - oversToBalls(open.overs) : 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["live", matchId] });
    qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
    qc.invalidateQueries({ queryKey: ["match", matchId] });
  };

  // Apply cricket rules to on-field state after a delivery (mirrors web):
  //  • batsmen cross on odd runs; ends swap at over's end (both → no net swap)
  //  • a wicket empties only the dismissed batter's slot
  //  • a completed over forces a new bowler
  const applyPostBall = (
    p: { runs_batsman?: number; extra_type?: string; extra_runs?: number; is_wicket?: boolean; wicket_type?: string; dismissed_player_id?: number; bowler_id: number },
    overCompleted: boolean,
  ) => {
    const ex = p.extra_type ?? "NONE";
    let ran = 0;
    if (ex === "NONE" || ex === "NO_BALL") ran = p.runs_batsman ?? 0;
    else if (ex === "BYE" || ex === "LEG_BYE") ran = p.extra_runs ?? 0;
    const crossed = ran % 2 === 1;
    const swap = crossed !== overCompleted;

    let newStriker: number | null = swap ? nonStriker : striker;
    let newNonStriker: number | null = swap ? striker : nonStriker;

    const notes: string[] = [];
    if (p.is_wicket && p.wicket_type !== "RETIRED_HURT") {
      const out = p.dismissed_player_id;
      if (out === newStriker) newStriker = null;
      else if (out === newNonStriker) newNonStriker = null;
      else newStriker = null;
      if (out) setDismissed((prev) => new Set(prev).add(out));
      notes.push("Wicket — choose the new batter.");
    }
    setStriker(newStriker);
    setNonStriker(newNonStriker);
    if (overCompleted) {
      setLastOverBowler(p.bowler_id);
      setBowler(null);
      notes.push("Over complete — strike rotated, pick the new bowler.");
    }
    setInfo(notes.join(" ") || null);
  };

  const send = async (partial: Record<string, unknown>) => {
    if (!ready || busy) return;
    const payload = {
      striker_id: striker as number,
      non_striker_id: nonStriker as number,
      bowler_id: bowler as number,
      runs_batsman: 0,
      ...partial,
    };
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.post(`/matches/${matchId}/scoring/ball`, payload);
      if ((payload as any).is_wicket) warn(); else success();
      // Write the authoritative new score straight from the response so the
      // displayed total updates instantly — no stale gap that makes the scorer
      // think the tap missed and re-tap (which double-counted runs).
      if (data?.live_score) qc.setQueryData(["live", matchId], data.live_score);
      setHistory((h) => [...h, { striker, nonStriker, bowler, lastOverBowler, dismissed: [...dismissed] }]);
      applyPostBall(payload as any, !!data?.over_completed);
      setWicketType(WICKET_TYPES[0]);
      setRunOutEnd("striker");
      setWicketOpen(false);
      refresh();
    } catch (e: any) {
      setInfo(null);
      setMsg(e?.response?.data?.detail ?? "Failed to record ball");
    } finally {
      setBusy(false);
    }
  };

  const startInnings = async (batId: number, bowlId: number) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/matches/${matchId}/innings`, { batting_team_id: batId, bowling_team_id: bowlId });
      await Promise.all([
        qc.refetchQueries({ queryKey: ["live", matchId] }),
        qc.refetchQueries({ queryKey: ["match", matchId] }),
      ]);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Could not start innings");
    } finally {
      setBusy(false);
    }
  };

  const recordToss = async (winnerId: number, decision: "BAT" | "BOWL") => {
    setBusy(true);
    try {
      await api.post(`/matches/${matchId}/toss`, { toss_winner_id: winnerId, decision });
      await qc.refetchQueries({ queryKey: ["match", matchId] });
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Could not record toss");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (busy) return;
    setBusy(true);
    const prev = history[history.length - 1];
    if (prev) {
      setStriker(prev.striker); setNonStriker(prev.nonStriker); setBowler(prev.bowler);
      setLastOverBowler(prev.lastOverBowler); setDismissed(new Set(prev.dismissed));
      setHistory((h) => h.slice(0, -1));
    } else {
      setDismissed(new Set());
    }
    setInfo(null);
    try {
      const { data } = await api.post(`/matches/${matchId}/scoring/undo`);
      if (data?.live_score) qc.setQueryData(["live", matchId], data.live_score);
      refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>Scoring console</Text>
      <Text style={{ color: t.muted, marginBottom: 14 }}>
        {teamName(teams, match.team_a_id)} vs {teamName(teams, match.team_b_id)} · {match.overs_limit} overs
      </Text>

      {open ? (
        <Card t={t}>
          <Text style={{ color: t.muted, textAlign: "center" }}>{teamName(teams, open.batting_team_id)}</Text>
          <Text style={{ color: t.text, fontSize: 34, fontWeight: "900", textAlign: "center" }}>
            {open.runs}/{open.wickets} <Text style={{ fontSize: 16, color: t.muted }}>({open.overs})</Text>
          </Text>
          {open.target != null && (
            <Text style={{ color: t.primary, fontWeight: "700", marginTop: 4, textAlign: "center" }}>
              Target {open.target} · need {Math.max(0, open.target - open.runs)} off {Math.max(0, ballsLeft)} ball{ballsLeft === 1 ? "" : "s"}
              {open.required_run_rate != null ? ` · RRR ${open.required_run_rate.toFixed(2)}` : ""}
            </Text>
          )}
          {freeHit && (
            <Text style={{ alignSelf: "center", marginTop: 10, backgroundColor: "#f59e0b", color: "#fff", fontWeight: "800", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, overflow: "hidden" }}>
              ⚡ FREE HIT — batter can only be run out
            </Text>
          )}
        </Card>
      ) : matchOver ? (
        <Card t={t}>
          <Text style={{ color: t.muted, textAlign: "center" }}>🏆 Match complete</Text>
          <Text style={{ color: t.primary, fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 4 }}>
            {match.result_text ?? "Result recorded — refreshing…"}
          </Text>
        </Card>
      ) : (
        <>
          {live?.innings?.[0] && (
            <Card t={t}>
              <Text style={{ color: "#f59e0b", fontWeight: "700", textAlign: "center" }}>Innings break</Text>
              <Text style={{ color: t.text, textAlign: "center", marginTop: 4 }}>
                {teamName(teams, live.innings[0].batting_team_id)} scored {live.innings[0].runs}/{live.innings[0].wickets} ({live.innings[0].overs})
              </Text>
              <Text style={{ color: t.muted, textAlign: "center", marginTop: 4, fontSize: 12 }}>
                {teamName(teams, live.innings[0].batting_team_id === match.team_a_id ? match.team_b_id : match.team_a_id)} need {live.innings[0].runs + 1} to win — start the 2nd innings below.
              </Text>
            </Card>
          )}
          {!canScore ? (
            <Card t={t}><Text style={{ color: "#ef4444", textAlign: "center" }}>You're not assigned to score this match — view only.</Text></Card>
          ) : (live?.innings.length ?? 0) === 0 && !match.toss_winner_id ? (
            <TossPanel t={t} match={match} teams={teams} onToss={recordToss} busy={busy} />
          ) : (
            <StartPanel
              t={t}
              match={match}
              teams={teams}
              existingInnings={live?.innings.length ?? 0}
              firstBattingTeamId={live?.innings[0]?.batting_team_id ?? null}
              onStart={startInnings}
              busy={busy}
            />
          )}
        </>
      )}

      {open && !canScore && (
        <Card t={t}><Text style={{ color: "#ef4444", textAlign: "center" }}>You're not assigned to score this match — view only.</Text></Card>
      )}

      {open && canScore && (
        <View>
          {/* Wait for both squads before showing selectors, so they're not empty. */}
          {(!teamA || !teamB) ? (
            <Card t={t}><Text style={{ color: t.muted, textAlign: "center" }}>Loading players…</Text></Card>
          ) : !ready ? (
            // Pickers appear only when a slot is empty — at the start, after an
            // over completes (new bowler), or when a wicket falls (new batter).
            <>
              <Picker t={t} title="🏏 Striker (on strike)" players={strikerOptions} value={striker} onPick={setStriker} />
              <Picker t={t} title="Non-striker" players={nonStrikerOptions} value={nonStriker} onPick={setNonStriker} />
              <Picker t={t} title="Bowler" players={bowlerOptions} value={bowler} onPick={setBowler} />
            </>
          ) : (
            // Locked compact summary — players can't be changed mid-over; the
            // over's end or a wicket re-opens the relevant picker (undo to fix).
            <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: t.text }}>
                🏏 <Text style={{ color: t.primary, fontWeight: "800" }}>{batPlayers.find((p) => p.id === striker)?.name ?? "—"}</Text>
                {"  &  "}{batPlayers.find((p) => p.id === nonStriker)?.name ?? "—"}
              </Text>
              <Text style={{ color: t.text, marginTop: 2 }}>🎯 {bowlPlayers.find((p) => p.id === bowler)?.name ?? "—"}</Text>
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 6 }}>🔒 Locked until the over ends or a wicket falls. Tap Undo to fix a mistake.</Text>
            </View>
          )}

          {msg && <Text style={{ color: "#fff", backgroundColor: "#ef4444", padding: 8, borderRadius: 8, marginVertical: 8 }}>{msg}</Text>}
          {info && <Text style={{ color: t.primary, fontWeight: "600", marginVertical: 8 }}>{info}</Text>}
          {!ready && (
            <Text style={{ color: "#b45309", backgroundColor: "#f59e0b22", padding: 10, borderRadius: 8, marginVertical: 8, fontWeight: "600" }}>
              {(() => {
                const need: string[] = [];
                if (!striker) need.push("striker");
                if (!nonStriker) need.push("non-striker");
                if (!bowler) need.push("bowler");
                if (striker && striker === nonStriker) return "Striker and non-striker must be different.";
                return `Select ${need.join(" & ")} above to ${need.length === 3 ? "enable" : "resume"} scoring.`;
              })()}
            </Text>
          )}

          {ready && (
            <>
              <Text style={{ color: t.muted, fontWeight: "700", marginTop: 12, marginBottom: 6 }}>RUNS</Text>
              <Row>
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <Btn key={r} t={t} label={String(r)} disabled={busy} onPress={() => send({ runs_batsman: r })}
                    style={{ flexGrow: 1, marginRight: 6, marginBottom: 6, backgroundColor: runColor(r, t) }} />
                ))}
              </Row>

              <Text style={{ color: t.muted, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>EXTRAS</Text>
              <Row>
                <Btn t={t} label="Wide" tone="amber" disabled={busy} onPress={() => send({ extra_type: "WIDE", extra_runs: 0 })} style={chipStyle} />
                <Btn t={t} label="No ball" tone="amber" disabled={busy} onPress={() => send({ extra_type: "NO_BALL", extra_runs: 0 })} style={chipStyle} />
                <Btn t={t} label="Bye" tone="amber" disabled={busy} onPress={() => send({ extra_type: "BYE", extra_runs: 1 })} style={chipStyle} />
                <Btn t={t} label="Leg bye" tone="amber" disabled={busy} onPress={() => send({ extra_type: "LEG_BYE", extra_runs: 1 })} style={chipStyle} />
              </Row>

              {/* Wicket panel stays hidden until you tap it — keeps the common
                  runs/extras within reach and avoids accidental dismissals. */}
              {!wicketOpen ? (
                <Btn t={t} label="🏏 Wicket…" tone="red" disabled={busy} style={{ marginTop: 12 }} onPress={() => setWicketOpen(true)} />
              ) : (
                <View style={{ marginTop: 12, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: t.muted, fontWeight: "700", marginBottom: 6 }}>HOW OUT?</Text>
                  <Row>
                    {(freeHit ? ["RUN_OUT"] : WICKET_TYPES).map((w) => (
                      <Seg key={w} t={t} label={w.replace("_", " ")} selected={effectiveWicket === w} onPress={() => setWicketType(w)} />
                    ))}
                  </Row>
                  {effectiveWicket === "RUN_OUT" && (
                    <Row>
                      <Seg t={t} label="Striker out" selected={runOutEnd === "striker"} onPress={() => setRunOutEnd("striker")} />
                      <Seg t={t} label="Non-striker out" selected={runOutEnd === "non_striker"} onPress={() => setRunOutEnd("non_striker")} />
                    </Row>
                  )}
                  {freeHit && <Text style={{ color: "#b45309", fontSize: 12, marginVertical: 6 }}>Free hit: only run-out counts.</Text>}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Btn t={t} label="Confirm OUT" tone="red" disabled={busy}
                        onPress={() => send({
                          is_wicket: true,
                          wicket_type: effectiveWicket,
                          dismissed_player_id: effectiveWicket === "RUN_OUT" && runOutEnd === "non_striker" ? nonStriker : striker,
                        })} />
                    </View>
                    <Btn t={t} label="Cancel" tone="ghost" disabled={busy} onPress={() => setWicketOpen(false)} />
                  </View>
                </View>
              )}
            </>
          )}

          <Btn t={t} label="↶ Undo last ball" tone="ghost" disabled={busy} style={{ marginTop: 14 }} onPress={undo} />
          {busy && <Text style={{ color: t.muted, textAlign: "center", marginTop: 8 }}>Saving…</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const chipStyle = { flexGrow: 1, marginRight: 6, marginBottom: 6 } as const;

function runColor(r: number, t: Theme): string {
  if (r === 4) return t.primary;
  if (r === 6) return "#6366f1";
  if (r === 0) return "#94a3b8";
  return "#475569";
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{children}</View>;
}

function Card({ t, children }: { t: Theme; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );
}

function Center({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 20 }}>{children}</View>;
}

function Btn({
  t, label, onPress, disabled, tone = "primary", style,
}: {
  t: Theme; label: string; onPress: () => void; disabled?: boolean;
  tone?: "primary" | "amber" | "red" | "ghost"; style?: object;
}) {
  const bg = tone === "amber" ? "#f59e0b" : tone === "red" ? "#ef4444" : tone === "ghost" ? "transparent" : t.primary;
  const fg = tone === "ghost" ? t.text : "#fff";
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={disabled}
      android_ripple={tone === "ghost" ? undefined : { color: "rgba(255,255,255,0.25)" }}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor: t.border,
        borderWidth: tone === "ghost" ? 1 : 0,
        padding: 12,
        borderRadius: 12,
        alignItems: "center",
        opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        ...style,
      })}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// Segmented selector chip (wicket type / run-out end / toss).
function Seg({ t, label, selected, onPress, disabled }: { t: Theme; label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: selected ? t.primary : t.surface,
        borderColor: selected ? t.primary : t.border,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 6,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: selected ? "#fff" : t.text, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function Picker({
  t, title, players, value, onPick,
}: {
  t: Theme; title: string; players: Player[]; value: number | null; onPick: (id: number) => void;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: t.muted, fontWeight: "700", marginBottom: 6 }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {players.map((p) => {
          const sel = p.id === value;
          return (
            <Pressable
              key={p.id}
              onPress={() => { tap(); onPick(p.id); }}
              style={({ pressed }) => ({
                backgroundColor: sel ? t.primary : t.surface,
                borderColor: sel ? t.primary : t.border,
                borderWidth: 1,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                marginRight: 6,
                marginBottom: 6,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Text style={{ color: sel ? "#fff" : t.text, fontSize: 12 }}>{p.name}</Text>
            </Pressable>
          );
        })}
        {!players.length && <Text style={{ color: t.muted }}>No players.</Text>}
      </View>
    </View>
  );
}

function StartPanel({
  t, match, teams, existingInnings, firstBattingTeamId, onStart, busy,
}: {
  t: Theme; match: Match; teams: Map<number, Team>; existingInnings: number;
  firstBattingTeamId: number | null; onStart: (batId: number, bowlId: number) => void; busy: boolean;
}) {
  // 2nd innings: the side that batted first can't bat again.
  const battedFirst = existingInnings === 1 ? firstBattingTeamId : null;
  const battingOptions = [match.team_a_id, match.team_b_id].filter((id) => id !== battedFirst);
  // 1st innings: default to whoever the toss put in to bat.
  const tossBat =
    existingInnings === 0 && match.toss_winner_id && match.toss_decision
      ? match.toss_decision === "BAT"
        ? match.toss_winner_id
        : match.toss_winner_id === match.team_a_id
          ? match.team_b_id
          : match.team_a_id
      : null;
  const [batId, setBatId] = useState(tossBat ?? battingOptions[0]);
  const bowlId = batId === match.team_a_id ? match.team_b_id : match.team_a_id;
  const locked = tossBat != null || battingOptions.length <= 1;

  if (existingInnings >= 2) return <Card t={t}><Text style={{ color: t.muted, textAlign: "center" }}>Both innings are complete.</Text></Card>;

  return (
    <Card t={t}>
      <Text style={{ color: t.text, fontWeight: "800", marginBottom: 8 }}>Start {existingInnings === 0 ? "first" : "second"} innings</Text>
      {tossBat != null && match.toss_winner_id && (
        <Text style={{ color: t.primary, fontWeight: "600", marginBottom: 8, fontSize: 13 }}>
          {teamName(teams, match.toss_winner_id)} won the toss & chose to {match.toss_decision === "BAT" ? "bat" : "bowl"}.
        </Text>
      )}
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Batting team</Text>
      {locked ? (
        <Text style={{ color: t.text, fontWeight: "700", marginBottom: 8 }}>{teamName(teams, batId)}</Text>
      ) : (
        <Row>
          {battingOptions.map((id) => (
            <Seg key={id} t={t} label={teamName(teams, id)} selected={batId === id} onPress={() => setBatId(id)} />
          ))}
        </Row>
      )}
      <Text style={{ color: t.muted, fontSize: 13, marginVertical: 8 }}>Bowling: {teamName(teams, bowlId)}</Text>
      <Btn t={t} label={busy ? "Starting…" : "Start innings"} disabled={busy} onPress={() => onStart(batId, bowlId)} />
    </Card>
  );
}

function TossPanel({
  t, match, teams, onToss, busy,
}: {
  t: Theme; match: Match; teams: Map<number, Team>; onToss: (winnerId: number, decision: "BAT" | "BOWL") => void; busy: boolean;
}) {
  const [winner, setWinner] = useState<number | null>(null);
  const [decision, setDecision] = useState<"BAT" | "BOWL">("BAT");
  const [flipping, setFlipping] = useState(false);
  const [face, setFace] = useState<"HEADS" | "TAILS" | null>(null);
  const spin = useRef(new Animated.Value(0)).current;

  const flip = () => {
    if (flipping) return;
    tap();
    setFlipping(true);
    setFace(null);
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      // The coin is for show — the admin records who actually won below.
      setFace(Math.random() < 0.5 ? "HEADS" : "TAILS");
      setFlipping(false);
    });
  };

  // End on a full-turn multiple (1800 = 5 turns) so the face text lands upright,
  // not mirrored. A separate face flag, not the rotation, picks heads/tails.
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1800deg"] });

  return (
    <Card t={t}>
      <Text style={{ color: t.text, fontWeight: "800", marginBottom: 2 }}>Toss</Text>
      <Text style={{ color: t.muted, fontSize: 13, marginBottom: 12 }}>Flip the coin, then record who won and what they chose.</Text>

      {/* Coin */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        <Animated.View
          style={{
            width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center",
            backgroundColor: face === "TAILS" ? "#f59e0b" : t.primary,
            transform: [{ rotateY: rotate }],
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: "900", color: "#fff" }}>{flipping ? "…" : face ?? "🪙"}</Text>
        </Animated.View>
      </View>
      <Btn t={t} tone="ghost" label={flipping ? "Flipping…" : face ? "Flip again" : "Flip coin"} disabled={flipping} onPress={flip} />

      {/* Result entry — enabled once the coin has been flipped (web parity). */}
      {face && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Toss won by</Text>
          <Row>
            {[match.team_a_id, match.team_b_id].map((id) => (
              <Seg key={id} t={t} label={teamName(teams, id)} selected={winner === id} disabled={busy} onPress={() => setWinner(id)} />
            ))}
          </Row>

          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>Chose to</Text>
          <Row>
            <Seg t={t} label="Bat first" selected={decision === "BAT"} disabled={busy} onPress={() => setDecision("BAT")} />
            <Seg t={t} label="Bowl first" selected={decision === "BOWL"} disabled={busy} onPress={() => setDecision("BOWL")} />
          </Row>

          <Btn t={t} label={busy ? "Saving…" : "Confirm toss"} disabled={!winner || busy} style={{ marginTop: 10 }}
            onPress={() => winner && onToss(winner, decision)} />
        </View>
      )}
    </Card>
  );
}
