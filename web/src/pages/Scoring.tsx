import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useMatch, useLiveScore, useTeam, usePostBall, useUndoBall, type BallPayload } from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { teamName, useTeamMap } from "@/hooks/useTeamMap";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import Spinner, { ErrorState } from "@/components/Spinner";
import type { Player } from "@/types";

const WICKET_TYPES = ["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET"];

function PlayerSelect({
  label,
  players,
  value,
  onChange,
}: {
  label: string;
  players: Player[];
  value: number | "";
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold muted">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="">Select…</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Scoring() {
  const { id } = useParams();
  const matchId = Number(id);
  const qc = useQueryClient();
  const teams = useTeamMap();

  const { data: match, isLoading, isError } = useMatch(matchId);
  const { data: live } = useLiveScore(matchId);
  const postBall = usePostBall(matchId);
  const undoBall = useUndoBall(matchId);
  useLiveSocket(matchId); // keep the displayed score live across devices too

  const openInnings = live?.innings.find((i) => !i.is_closed) ?? null;
  const battingTeamId = openInnings?.batting_team_id ?? null;
  const bowlingTeamId = openInnings?.bowling_team_id ?? null;

  const { data: teamA } = useTeam(match?.team_a_id ?? 0);
  const { data: teamB } = useTeam(match?.team_b_id ?? 0);

  const battingPlayers = useMemo<Player[]>(() => {
    if (!battingTeamId) return [];
    return (teamA?.id === battingTeamId ? teamA?.players : teamB?.players) ?? [];
  }, [battingTeamId, teamA, teamB]);
  const bowlingPlayers = useMemo<Player[]>(() => {
    if (!bowlingTeamId) return [];
    return (teamA?.id === bowlingTeamId ? teamA?.players : teamB?.players) ?? [];
  }, [bowlingTeamId, teamA, teamB]);

  const [striker, setStriker] = useState<number | "">("");
  const [nonStriker, setNonStriker] = useState<number | "">("");
  const [bowler, setBowler] = useState<number | "">("");
  const [wicketType, setWicketType] = useState(WICKET_TYPES[0]);
  const [runOutEnd, setRunOutEnd] = useState<"striker" | "non_striker">("striker");
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => setMsg(null), [striker, bowler]);

  if (isLoading) return <Spinner />;
  if (isError || !match) return <ErrorState />;

  const ready = striker && nonStriker && bowler && striker !== nonStriker;

  async function send(partial: Partial<BallPayload>) {
    if (!ready) {
      setMsg("Pick striker, non-striker and bowler first (striker ≠ non-striker).");
      return;
    }
    const payload: BallPayload = {
      striker_id: Number(striker),
      non_striker_id: Number(nonStriker),
      bowler_id: Number(bowler),
      runs_batsman: 0,
      ...partial,
    };
    try {
      const res = await postBall.mutateAsync(payload);
      setMsg(null);
      applyPostBall(payload, res.over_completed);
    } catch (e: unknown) {
      setInfo(null);
      setMsg((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to record ball");
    }
  }

  // Apply real cricket rules to the on-field state after a delivery:
  //  • batsmen cross on odd runs; ends swap at over's end (both → no net swap)
  //  • a wicket empties only the dismissed batsman's slot (not-out batter stays)
  //  • a completed over forces a new bowler (no consecutive overs)
  function applyPostBall(payload: BallPayload, overCompleted: boolean) {
    const ex = payload.extra_type ?? "NONE";
    let ran = 0;
    if (ex === "NONE" || ex === "NO_BALL") ran = payload.runs_batsman ?? 0;
    else if (ex === "BYE" || ex === "LEG_BYE") ran = payload.extra_runs ?? 0;
    const crossed = ran % 2 === 1;
    const swap = crossed !== overCompleted;

    let newStriker: number | "" = swap ? nonStriker : striker;
    let newNonStriker: number | "" = swap ? striker : nonStriker;

    const notes: string[] = [];
    if (payload.is_wicket && payload.wicket_type !== "RETIRED_HURT") {
      const out = payload.dismissed_player_id;
      if (out === newStriker) newStriker = "";
      else if (out === newNonStriker) newNonStriker = "";
      else newStriker = ""; // fallback: striker out
      notes.push("Wicket — choose the new batsman.");
    }

    setStriker(newStriker);
    setNonStriker(newNonStriker);

    if (overCompleted) {
      setBowler(""); // a bowler can't bowl two overs in a row
      notes.push("Over complete — strike rotated, pick the new bowler.");
    }
    setInfo(notes.join(" ") || null);
  }

  async function startInnings(batId: number, bowlId: number) {
    try {
      await api.post(`/matches/${matchId}/innings`, {
        batting_team_id: batId,
        bowling_team_id: bowlId,
      });
      qc.invalidateQueries({ queryKey: ["live", matchId] });
      qc.invalidateQueries({ queryKey: ["match", matchId] });
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Could not start innings");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Scoring console</h1>
      <p className="mb-5 muted">
        {teamName(teams, match.team_a_id)} vs {teamName(teams, match.team_b_id)} · {match.overs_limit} overs
      </p>

      {/* Current score */}
      {openInnings ? (
        <div className="card-surface mb-5 p-5 text-center">
          <div className="text-sm muted">{teamName(teams, openInnings.batting_team_id)}</div>
          <div className="text-4xl font-extrabold">
            {openInnings.runs}/{openInnings.wickets}
            <span className="ml-2 text-lg font-medium muted">({openInnings.overs})</span>
          </div>
          {openInnings.target != null && (
            <div className="mt-1 text-sm muted">Target {openInnings.target} · RRR {openInnings.required_run_rate?.toFixed(2)}</div>
          )}
        </div>
      ) : match.status === "COMPLETED" ? (
        <div className="card-surface mb-5 p-5 text-center">
          <div className="text-sm muted">Match complete</div>
          <div className="mt-1 text-xl font-extrabold text-pitch-600">
            {match.result_text ?? "Result recorded"}
          </div>
        </div>
      ) : (
        <>
          {live?.innings?.[0] && (
            <div className="card-surface mb-4 p-4 text-center">
              <div className="text-sm font-semibold text-amber-500">Innings break</div>
              <div className="mt-1">
                <span className="font-bold">{teamName(teams, live.innings[0].batting_team_id)}</span>{" "}
                scored <b>{live.innings[0].runs}/{live.innings[0].wickets}</b> ({live.innings[0].overs})
              </div>
              <div className="mt-1 text-sm muted">
                {teamName(
                  teams,
                  live.innings[0].batting_team_id === match.team_a_id ? match.team_b_id : match.team_a_id,
                )}{" "}
                need <b>{live.innings[0].runs + 1}</b> to win — start the 2nd innings below.
              </div>
            </div>
          )}
          <StartPanel
            match={match}
            teams={teams}
            existingInnings={live?.innings.length ?? 0}
            firstBattingTeamId={live?.innings[0]?.batting_team_id ?? null}
            onStart={startInnings}
          />
        </>
      )}

      {openInnings && (
        <>
          {/* Player selectors */}
          <div className="card-surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
            <PlayerSelect label="🏏 Striker (on strike)" players={battingPlayers} value={striker} onChange={setStriker} />
            <PlayerSelect label="Non-striker" players={battingPlayers} value={nonStriker} onChange={setNonStriker} />
            <PlayerSelect label="Bowler" players={bowlingPlayers} value={bowler} onChange={setBowler} />
          </div>

          {striker && (
            <p className="mb-3 text-sm muted">
              On strike:{" "}
              <span className="font-semibold text-pitch-600">
                {battingPlayers.find((p) => p.id === Number(striker))?.name ?? "—"}
              </span>{" "}
              · strike rotates automatically on odd runs and at over's end.
            </p>
          )}

          {msg && <p className="mb-3 text-sm text-red-500">{msg}</p>}
          {info && <p className="mb-3 text-sm font-medium text-pitch-600">{info}</p>}

          {/* Run buttons */}
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 text-xs font-semibold muted">RUNS</div>
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button
                  key={r}
                  className={`rounded-xl py-4 text-xl font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${runBtnColor(r)}`}
                  disabled={postBall.isPending}
                  onClick={() => send({ runs_batsman: r })}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Extras */}
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 text-xs font-semibold muted">EXTRAS</div>
            <div className="grid grid-cols-4 gap-2">
              <ExtraBtn label="Wide" onClick={() => send({ extra_type: "WIDE", extra_runs: 0 })} disabled={postBall.isPending} />
              <ExtraBtn label="No ball" onClick={() => send({ extra_type: "NO_BALL", extra_runs: 0 })} disabled={postBall.isPending} />
              <ExtraBtn label="Bye" onClick={() => send({ extra_type: "BYE", extra_runs: 1 })} disabled={postBall.isPending} />
              <ExtraBtn label="Leg bye" onClick={() => send({ extra_type: "LEG_BYE", extra_runs: 1 })} disabled={postBall.isPending} />
            </div>
          </div>

          {/* Wicket */}
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 text-xs font-semibold muted">WICKET</div>
            <div className="flex flex-wrap gap-2">
              <select className="input flex-1" value={wicketType} onChange={(e) => setWicketType(e.target.value)}>
                {WICKET_TYPES.map((w) => (
                  <option key={w} value={w}>
                    {w.replace("_", " ")}
                  </option>
                ))}
              </select>
              {/* Run-out can dismiss either batsman; everything else is the striker. */}
              {wicketType === "RUN_OUT" && (
                <select className="input flex-1" value={runOutEnd} onChange={(e) => setRunOutEnd(e.target.value as "striker" | "non_striker")}>
                  <option value="striker">Striker out</option>
                  <option value="non_striker">Non-striker out</option>
                </select>
              )}
              <button
                className="rounded-lg bg-red-500 px-4 py-2 font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                disabled={postBall.isPending}
                onClick={() =>
                  send({
                    is_wicket: true,
                    wicket_type: wicketType,
                    dismissed_player_id:
                      wicketType === "RUN_OUT" && runOutEnd === "non_striker"
                        ? Number(nonStriker)
                        : Number(striker),
                  })
                }
              >
                OUT
              </button>
            </div>
          </div>

          <button
            className="btn-ghost w-full"
            disabled={undoBall.isPending}
            onClick={() => undoBall.mutate()}
          >
            ↶ Undo last ball
          </button>
        </>
      )}
    </div>
  );
}

function runBtnColor(r: number): string {
  if (r === 4) return "bg-pitch-500 hover:bg-pitch-600";
  if (r === 6) return "bg-indigo-500 hover:bg-indigo-600";
  if (r === 0) return "bg-slate-400 hover:bg-slate-500";
  return "bg-slate-600 hover:bg-slate-700";
}

function ExtraBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      className="rounded-lg border py-3 text-sm font-semibold transition hover:bg-amber-500 hover:text-white disabled:opacity-50"
      style={{ borderColor: "var(--border)" }}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function StartPanel({
  match,
  teams,
  existingInnings,
  firstBattingTeamId,
  onStart,
}: {
  match: import("@/types").Match;
  teams: Map<number, import("@/types").Team>;
  existingInnings: number;
  firstBattingTeamId: number | null;
  onStart: (batId: number, bowlId: number) => void;
}) {
  // For the 2nd innings, default the batting side to whoever bowled first.
  const defaultBat =
    existingInnings === 1 && firstBattingTeamId
      ? firstBattingTeamId === match.team_a_id
        ? match.team_b_id
        : match.team_a_id
      : match.team_a_id;
  const [batId, setBatId] = useState(defaultBat);
  const bowlId = batId === match.team_a_id ? match.team_b_id : match.team_a_id;

  if (existingInnings >= 2) {
    return <div className="card-surface mb-5 p-5 text-center muted">Both innings are complete.</div>;
  }

  return (
    <div className="card-surface mb-5 p-5">
      <h2 className="mb-3 font-bold">Start {existingInnings === 0 ? "first" : "second"} innings</h2>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold muted">Batting team</span>
        <select className="input" value={batId} onChange={(e) => setBatId(Number(e.target.value))}>
          <option value={match.team_a_id}>{teamName(teams, match.team_a_id)}</option>
          <option value={match.team_b_id}>{teamName(teams, match.team_b_id)}</option>
        </select>
      </label>
      <p className="mb-3 text-sm muted">Bowling: {teamName(teams, bowlId)}</p>
      <button className="btn-primary w-full" onClick={() => onStart(batId, bowlId)}>
        Start innings
      </button>
    </div>
  );
}
