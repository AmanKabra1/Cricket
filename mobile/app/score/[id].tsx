import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/api/auth";
import { useLiveScore, useMatch, useTeam } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useTheme, type Theme } from "@/theme";
import type { InningsScore, Player } from "@/types";

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
  const { data: teamA } = useTeam(match?.team_a_id ?? 0);
  const { data: teamB } = useTeam(match?.team_b_id ?? 0);

  const open = live?.innings.find((i: InningsScore) => !i.is_closed) ?? null;
  const [striker, setStriker] = useState<number | null>(null);
  const [nonStriker, setNonStriker] = useState<number | null>(null);
  const [bowler, setBowler] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStriker(null);
    setNonStriker(null);
    setBowler(null);
  }, [open?.innings_id]);

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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["live", matchId] });
    qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
    qc.invalidateQueries({ queryKey: ["match", matchId] });
  };

  const startInnings = async (batId: number) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/matches/${matchId}/innings`, {
        batting_team_id: batId,
        bowling_team_id: batId === match.team_a_id ? match.team_b_id : match.team_a_id,
      });
      await qc.refetchQueries({ queryKey: ["live", matchId] });
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Could not start innings");
    } finally {
      setBusy(false);
    }
  };

  const send = async (partial: Record<string, unknown>) => {
    if (!striker || !nonStriker || !bowler || striker === nonStriker) {
      setMsg("Pick striker, non-striker and bowler (striker ≠ non-striker).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/matches/${matchId}/scoring/ball`, {
        striker_id: striker,
        non_striker_id: nonStriker,
        bowler_id: bowler,
        runs_batsman: 0,
        ...partial,
      });
      refresh();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Failed to record ball");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setBusy(true);
    try {
      await api.post(`/matches/${matchId}/scoring/undo`);
      refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const batPlayers: Player[] = open
    ? (teamA?.id === open.batting_team_id ? teamA?.players : teamB?.players) ?? []
    : [];
  const bowlPlayers: Player[] = open
    ? (teamA?.id === open.bowling_team_id ? teamA?.players : teamB?.players) ?? []
    : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>Scoring console</Text>
      <Text style={{ color: t.muted, marginBottom: 14 }}>
        {teamName(teams, match.team_a_id)} vs {teamName(teams, match.team_b_id)} · {match.overs_limit} overs
      </Text>

      {open ? (
        <Card t={t}>
          <Text style={{ color: t.muted }}>{teamName(teams, open.batting_team_id)}</Text>
          <Text style={{ color: t.text, fontSize: 32, fontWeight: "900" }}>
            {open.runs}/{open.wickets} <Text style={{ fontSize: 16, color: t.muted }}>({open.overs})</Text>
          </Text>
          {open.target != null && (
            <Text style={{ color: t.primary, fontWeight: "700", marginTop: 4 }}>
              Target {open.target} · need {Math.max(0, open.target - open.runs)} to win
            </Text>
          )}
        </Card>
      ) : match.status === "COMPLETED" ? (
        <Card t={t}>
          <Text style={{ color: t.muted }}>Match complete</Text>
          <Text style={{ color: t.primary, fontSize: 18, fontWeight: "800" }}>{match.result_text ?? "Result recorded"}</Text>
        </Card>
      ) : (
        <Card t={t}>
          <Text style={{ color: t.text, fontWeight: "700", marginBottom: 8 }}>Start innings — batting team</Text>
          {[match.team_a_id, match.team_b_id].map((tid) => (
            <Btn key={tid} t={t} label={teamName(teams, tid)} onPress={() => startInnings(tid)} disabled={busy} style={{ marginBottom: 8 }} />
          ))}
        </Card>
      )}

      {open && (
        <>
          <Picker t={t} title="🏏 Striker" players={batPlayers.filter((p) => p.id !== nonStriker)} value={striker} onPick={setStriker} />
          <Picker t={t} title="Non-striker" players={batPlayers.filter((p) => p.id !== striker)} value={nonStriker} onPick={setNonStriker} />
          <Picker t={t} title="Bowler" players={bowlPlayers} value={bowler} onPick={setBowler} />

          {msg && <Text style={{ color: t.text, backgroundColor: "#ef444422", padding: 8, borderRadius: 8, marginVertical: 8 }}>{msg}</Text>}

          <Text style={{ color: t.muted, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>RUNS</Text>
          <Row>
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <Btn key={r} t={t} label={String(r)} disabled={busy} onPress={() => send({ runs_batsman: r })} style={{ flexGrow: 1, marginRight: 6, marginBottom: 6 }} />
            ))}
          </Row>

          <Text style={{ color: t.muted, fontWeight: "700", marginTop: 8, marginBottom: 6 }}>EXTRAS</Text>
          <Row>
            <Btn t={t} label="Wide" tone="amber" disabled={busy} onPress={() => send({ extra_type: "WIDE", extra_runs: 0 })} style={chip} />
            <Btn t={t} label="No ball" tone="amber" disabled={busy} onPress={() => send({ extra_type: "NO_BALL", extra_runs: 0 })} style={chip} />
            <Btn t={t} label="Bye" tone="amber" disabled={busy} onPress={() => send({ extra_type: "BYE", extra_runs: 1 })} style={chip} />
            <Btn t={t} label="Leg bye" tone="amber" disabled={busy} onPress={() => send({ extra_type: "LEG_BYE", extra_runs: 1 })} style={chip} />
          </Row>

          <Btn t={t} label="OUT (bowled)" tone="red" disabled={busy} style={{ marginTop: 10 }}
            onPress={() => send({ is_wicket: true, wicket_type: "BOWLED", dismissed_player_id: striker })} />
          <Btn t={t} label="↶ Undo last ball" tone="ghost" disabled={busy} style={{ marginTop: 10 }} onPress={undo} />
        </>
      )}
    </ScrollView>
  );
}

const chip = { flexGrow: 1, marginRight: 6, marginBottom: 6 } as const;

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
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: bg, borderColor: t.border, borderWidth: tone === "ghost" ? 1 : 0, padding: 12, borderRadius: 10, alignItems: "center", opacity: disabled ? 0.6 : 1, ...style }}
    >
      <Text style={{ color: fg, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
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
            <TouchableOpacity
              key={p.id}
              onPress={() => onPick(p.id)}
              style={{ backgroundColor: sel ? t.primary : t.surface, borderColor: sel ? t.primary : t.border, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, marginRight: 6, marginBottom: 6 }}
            >
              <Text style={{ color: sel ? "#fff" : t.text, fontSize: 12 }}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
        {!players.length && <Text style={{ color: t.muted }}>No players.</Text>}
      </View>
    </View>
  );
}
