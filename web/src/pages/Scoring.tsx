import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useMatch, useLiveScore, useScorecard, useTeam, usePostBall, useUndoBall, type BallPayload } from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { teamName, useTeamMap } from "@/hooks/useTeamMap";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useAppSelector } from "@/store";/*  */
import Spinner, { ErrorState } from "@/components/Spinner";
import type { Player } from "@/types";

const WICKET_TYPES = ["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET"];

// On-field positions captured before a ball, restored on undo.
type Snapshot = {
  striker: number | "";
  nonStriker: number | "";
  bowler: number | "";
  lastOverBowler: number | "";
  dismissed: number[];
};

// The scorer's on-field selections are kept in localStorage per match+innings,
// so closing the tab and reopening the scoring link restores them (the score
// itself always comes from the server; this is just the UI's batter/bowler
// picks, which would otherwise reset to empty on reload).
type Persisted = Omit<Snapshot, never>;

const scoringKey = (matchId: number, inningsId: number) => `localscore:scoring:${matchId}:${inningsId}`;

function loadScoring(matchId: number, inningsId: number): Persisted | null {
  try {
    const raw = localStorage.getItem(scoringKey(matchId, inningsId));
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function saveScoring(matchId: number, inningsId: number, data: Persisted) {
  try {
    localStorage.setItem(scoringKey(matchId, inningsId), JSON.stringify(data));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

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
  const user = useAppSelector((s) => s.auth.user);

  const { data: match, isLoading, isError } = useMatch(matchId);
  const { data: live } = useLiveScore(matchId);
  const { data: scorecard } = useScorecard(matchId);
  const postBall = usePostBall(matchId);
  const undoBall = useUndoBall(matchId);
  useLiveSocket(matchId); // keep the displayed score live across devices too

  const openInnings = live?.innings.find((i) => !i.is_closed) ?? null;
  const battingTeamId = openInnings?.batting_team_id ?? null;
  const bowlingTeamId = openInnings?.bowling_team_id ?? null;

  const { data: teamA } = useTeam(match?.team_a_id ?? 0);
  const { data: teamB } = useTeam(match?.team_b_id ?? 0);

  const [striker, setStriker] = useState<number | "">("");
  const [nonStriker, setNonStriker] = useState<number | "">("");
  const [bowler, setBowler] = useState<number | "">("");
  const [wicketType, setWicketType] = useState(WICKET_TYPES[0]);
  const [runOutEnd, setRunOutEnd] = useState<"striker" | "non_striker">("striker");
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Players already dismissed this innings — hidden from the batter selectors.
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  // The bowler of the just-completed over — can't bowl the next one.
  const [lastOverBowler, setLastOverBowler] = useState<number | "">("");
  // Snapshots of the on-field positions BEFORE each ball, so "Undo" can put the
  // striker/non-striker/bowler back exactly where they were.
  const [history, setHistory] = useState<Snapshot[]>([]);

  // Out players: from the scorecard (authoritative, per innings) + just-dismissed.
  const outIds = useMemo(() => {
    const s = new Set<number>(dismissed);
    scorecard?.innings.forEach((inn) => {
      if (openInnings && inn.innings_id === openInnings.innings_id) {
        inn.batting.forEach((b) => {
          if (b.is_out) s.add(b.player_id);
        });
      }
    });
    return s;
  }, [scorecard, openInnings, dismissed]);

  // On (re)entering an open innings, restore the scorer's last on-field picks
  // from localStorage so reopening the link doesn't wipe them; a brand-new
  // innings (nothing saved) starts fresh. Undo history is not persisted.
  useEffect(() => {
    // Always reset the wicket selector and undo history for a fresh innings.
    setWicketType(WICKET_TYPES[0]);
    setRunOutEnd("striker");
    setHistory([]);
    const innId = openInnings?.innings_id;
    if (!innId) {
      setDismissed(new Set());
      setLastOverBowler("");
      setStriker("");
      setNonStriker("");
      setBowler("");
      return;
    }
    const saved = loadScoring(matchId, innId);
    setStriker(saved?.striker ?? "");
    setNonStriker(saved?.nonStriker ?? "");
    setBowler(saved?.bowler ?? "");
    setLastOverBowler(saved?.lastOverBowler ?? "");
    setDismissed(new Set(saved?.dismissed ?? []));
  }, [openInnings?.innings_id, matchId]);

  // Persist the on-field picks whenever they change (per match + innings).
  useEffect(() => {
    const innId = openInnings?.innings_id;
    if (!innId) return;
    saveScoring(matchId, innId, { striker, nonStriker, bowler, lastOverBowler, dismissed: [...dismissed] });
  }, [striker, nonStriker, bowler, lastOverBowler, dismissed, openInnings?.innings_id, matchId]);

  const allBatters = useMemo<Player[]>(() => {
    if (!battingTeamId) return [];
    return (teamA?.id === battingTeamId ? teamA?.players : teamB?.players) ?? [];
  }, [battingTeamId, teamA, teamB]);
  // Out batters are not selectable.
  const battingPlayers = useMemo<Player[]>(
    () => allBatters.filter((p) => !outIds.has(p.id)),
    [allBatters, outIds],
  );
  const bowlingPlayers = useMemo<Player[]>(() => {
    if (!bowlingTeamId) return [];
    return (teamA?.id === bowlingTeamId ? teamA?.players : teamB?.players) ?? [];
  }, [bowlingTeamId, teamA, teamB]);

  // Striker ≠ non-striker (each hidden from the other's list); bowler can't bowl
  // two overs in a row (last over's bowler hidden until someone else bowls).
  const strikerOptions = battingPlayers.filter((p) => p.id !== nonStriker);
  const nonStrikerOptions = battingPlayers.filter((p) => p.id !== striker);
  const bowlerOptions = bowlingPlayers.filter((p) => p.id !== lastOverBowler);

  useEffect(() => setMsg(null), [striker, bowler]);

  // Tell the backend who's at the crease so a freshly sent-in batter shows in
  // the scorecard at 0* before facing a ball.
  useEffect(() => {
    const mayScore = !!user && !!match && (user.role === "SUPER_ADMIN" || (match.admin_ids ?? []).includes(user.id));
    if (!mayScore || !openInnings) return;
    if (striker === "" || nonStriker === "" || striker === nonStriker) return;
    api
      .post(`/matches/${matchId}/scoring/at-crease`, {
        striker_id: Number(striker),
        non_striker_id: Number(nonStriker),
      })
      .then(() => qc.invalidateQueries({ queryKey: ["scorecard", matchId] }))
      .catch(() => {});
  }, [striker, nonStriker, openInnings?.innings_id, user, match, matchId, qc]);

  if (isLoading) return <Spinner />;
  if (isError || !match) return <ErrorState />;

  const ready = striker && nonStriker && bowler && striker !== nonStriker;
  const busy = postBall.isPending || undoBall.isPending; // lock the panel while saving
  // Only assigned admins (or any super admin) may edit the score.
  const canScore =
    !!user && (user.role === "SUPER_ADMIN" || (match.admin_ids ?? []).includes(user.id));
  // After a no-ball the next delivery is a free hit — the batter can only be run out.
  const freeHit = !!live?.free_hit;
  // Coerce the dismissal type to run-out while a free hit is in effect.
  const effectiveWicket = freeHit ? "RUN_OUT" : wicketType;

  async function send(partial: Partial<BallPayload>) {
    // Controls are disabled until ready, so this is just a defensive no-op.
    if (!ready) return;
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
      // Remember where everyone stood BEFORE this ball, so undo can restore it.
      setHistory((h) => [
        ...h,
        { striker, nonStriker, bowler, lastOverBowler, dismissed: [...dismissed] },
      ]);
      applyPostBall(payload, res.over_completed);
      // Reset the wicket selector back to default after every delivery.
      setWicketType(WICKET_TYPES[0]);
      setRunOutEnd("striker");
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
      if (out) setDismissed((prev) => new Set(prev).add(out)); // hide them from selectors
      notes.push("Wicket — choose the new batsman.");
    }

    setStriker(newStriker);
    setNonStriker(newNonStriker);

    if (overCompleted) {
      setLastOverBowler(payload.bowler_id); // can't bowl the next over
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

  async function recordToss(winnerId: number, decision: "BAT" | "BOWL") {
    await api.post(`/matches/${matchId}/toss`, { toss_winner_id: winnerId, decision });
    qc.invalidateQueries({ queryKey: ["match", matchId] });
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
            <div className="mt-1 text-sm font-semibold text-pitch-600">
              Target {openInnings.target} (beat {openInnings.target - 1}) · need{" "}
              {Math.max(0, openInnings.target - openInnings.runs)} to win
              {openInnings.required_run_rate != null && (
                <span className="muted"> · RRR {openInnings.required_run_rate.toFixed(2)}</span>
              )}
            </div>
          )}
          {freeHit && (
            <div className="mx-auto mt-3 inline-block rounded-full bg-amber-500 px-4 py-1 text-sm font-extrabold uppercase tracking-wide text-white">
              ⚡ Free hit — batter can only be run out
            </div>
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
          {canScore ? (
            (live?.innings.length ?? 0) === 0 && !match.toss_winner_id ? (
              <TossPanel match={match} teams={teams} onToss={recordToss} />
            ) : (
              <StartPanel
                match={match}
                teams={teams}
                existingInnings={live?.innings.length ?? 0}
                firstBattingTeamId={live?.innings[0]?.batting_team_id ?? null}
                onStart={startInnings}
              />
            )
          ) : (
            <div className="card-surface p-5 text-center text-red-500">
              You're not assigned to score this match — view only.
            </div>
          )}
        </>
      )}

      {openInnings && !canScore && (
        <div className="card-surface p-5 text-center text-red-500">
          You're not assigned to score this match — view only. Ask a super admin to assign you.
        </div>
      )}

      {openInnings && canScore && (
        <div className="relative">
          {busy && (
            <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-black/20 backdrop-blur-[1px]">
              <span className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold shadow dark:bg-navy-800 dark:text-white">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-pitch-500 border-t-transparent" />
                Saving…
              </span>
            </div>
          )}
          {/* fieldset disabled locks every control while a ball is saving */}
          <fieldset disabled={busy} className="m-0 border-0 p-0">
          {/* Player selectors */}
          <div className="card-surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
            <PlayerSelect label="🏏 Striker (on strike)" players={strikerOptions} value={striker} onChange={setStriker} />
            <PlayerSelect label="Non-striker" players={nonStrikerOptions} value={nonStriker} onChange={setNonStriker} />
            <PlayerSelect label="Bowler" players={bowlerOptions} value={bowler} onChange={setBowler} />
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
          {/* Gentle hint instead of an error — controls below stay disabled until ready. */}
          {!ready && (
            <p className="mb-3 text-sm muted">Select striker, non-striker &amp; bowler above to start scoring.</p>
          )}

          {/* Run buttons */}
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 text-xs font-semibold muted">RUNS</div>
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button
                  key={r}
                  className={`rounded-xl py-4 text-xl font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${runBtnColor(r)}`}
                  disabled={postBall.isPending || !ready}
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
              <ExtraBtn label="Wide" onClick={() => send({ extra_type: "WIDE", extra_runs: 0 })} disabled={postBall.isPending || !ready} />
              <ExtraBtn label="No ball" onClick={() => send({ extra_type: "NO_BALL", extra_runs: 0 })} disabled={postBall.isPending || !ready} />
              <ExtraBtn label="Bye" onClick={() => send({ extra_type: "BYE", extra_runs: 1 })} disabled={postBall.isPending || !ready} />
              <ExtraBtn label="Leg bye" onClick={() => send({ extra_type: "LEG_BYE", extra_runs: 1 })} disabled={postBall.isPending || !ready} />
            </div>
          </div>

          {/* Wicket — on a free hit only a run-out is allowed. */}
          <div className="card-surface mb-4 p-4">
            <div className="mb-2 text-xs font-semibold muted">WICKET</div>
            <div className="flex flex-wrap gap-2">
              <select
                className="input flex-1"
                value={effectiveWicket}
                disabled={freeHit}
                onChange={(e) => setWicketType(e.target.value)}
              >
                {(freeHit ? ["RUN_OUT"] : WICKET_TYPES).map((w) => (
                  <option key={w} value={w}>
                    {w.replace("_", " ")}
                  </option>
                ))}
              </select>
              {/* Run-out can dismiss either batsman; everything else is the striker. */}
              {effectiveWicket === "RUN_OUT" && (
                <select className="input flex-1" value={runOutEnd} onChange={(e) => setRunOutEnd(e.target.value as "striker" | "non_striker")}>
                  <option value="striker">Striker out</option>
                  <option value="non_striker">Non-striker out</option>
                </select>
              )}
              <button
                className="rounded-lg bg-red-500 px-4 py-2 font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                disabled={postBall.isPending || !ready}
                onClick={() =>
                  send({
                    is_wicket: true,
                    wicket_type: effectiveWicket,
                    dismissed_player_id:
                      effectiveWicket === "RUN_OUT" && runOutEnd === "non_striker"
                        ? Number(nonStriker)
                        : Number(striker),
                  })
                }
              >
                OUT
              </button>
            </div>
            {freeHit && <p className="mt-2 text-xs text-amber-600">Free hit: only run-out counts.</p>}
          </div>

          <button
            className="btn-ghost w-full"
            disabled={undoBall.isPending}
            onClick={() => {
              // Put the batters/bowler back where they were before the last ball.
              const prev = history[history.length - 1];
              if (prev) {
                setStriker(prev.striker);
                setNonStriker(prev.nonStriker);
                setBowler(prev.bowler);
                setLastOverBowler(prev.lastOverBowler);
                setDismissed(new Set(prev.dismissed));
                setHistory((h) => h.slice(0, -1));
              } else {
                setDismissed(new Set()); // re-derive out list from the scorecard
              }
              setInfo(null);
              undoBall.mutate();
            }}
          >
            ↶ Undo last ball
          </button>
          </fieldset>
        </div>
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
  onStart: (batId: number, bowlId: number) => void | Promise<void>;
}) {
  // For the 2nd innings the team that batted first can't bat again — only the
  // side that bowled first may be picked (so it's not even offered).
  const battedFirst = existingInnings === 1 ? firstBattingTeamId : null;
  const battingOptions = [match.team_a_id, match.team_b_id].filter((id) => id !== battedFirst);
  // For the 1st innings, default to whoever the toss put in to bat.
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
  const [starting, setStarting] = useState(false);

  if (existingInnings >= 2) {
    return <div className="card-surface mb-5 p-5 text-center muted">Both innings are complete.</div>;
  }

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await onStart(batId, bowlId);
    } finally {
      setStarting(false);
    }
  };

  // The batting side is fixed when the toss already decided it (1st innings) or
  // when only one team can bat (2nd innings) — no need to ask again.
  const locked = tossBat != null || battingOptions.length <= 1;

  return (
    <div className="card-surface mb-5 p-5">
      <h2 className="mb-3 font-bold">Start {existingInnings === 0 ? "first" : "second"} innings</h2>
      {tossBat != null && match.toss_winner_id && (
        <p className="mb-3 text-sm font-medium text-pitch-600">
          {teamName(teams, match.toss_winner_id)} won the toss & chose to{" "}
          {match.toss_decision === "BAT" ? "bat" : "bowl"}.
        </p>
      )}
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-semibold muted">Batting team</span>
        {locked ? (
          <div className="input flex items-center font-semibold">{teamName(teams, batId)}</div>
        ) : (
          <select className="input" value={batId} onChange={(e) => setBatId(Number(e.target.value))}>
            {battingOptions.map((id) => (
              <option key={id} value={id}>{teamName(teams, id)}</option>
            ))}
          </select>
        )}
      </label>
      <p className="mb-3 text-sm muted">Bowling: {teamName(teams, bowlId)}</p>
      <button className="btn-primary w-full" onClick={start} disabled={starting}>
        {starting ? "Starting…" : "Start innings"}
      </button>
    </div>
  );
}

function TossPanel({
  match,
  teams,
  onToss,
}: {
  match: import("@/types").Match;
  teams: Map<number, import("@/types").Team>;
  onToss: (winnerId: number, decision: "BAT" | "BOWL") => Promise<void>;
}) {
  const [flipping, setFlipping] = useState(false);
  const [face, setFace] = useState<"HEADS" | "TAILS" | null>(null);
  const [winner, setWinner] = useState<number | "">("");
  const [decision, setDecision] = useState<"BAT" | "BOWL">("BAT");
  const [saving, setSaving] = useState(false);

  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    setFace(null);
    // Animate, then settle on a random face (~50/50).
    setTimeout(() => {
      setFace(Math.random() < 0.5 ? "HEADS" : "TAILS");
      setFlipping(false);
    }, 1100);
  };

  const confirm = async () => {
    if (!winner) return;
    setSaving(true);
    try {
      await onToss(Number(winner), decision);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-surface mb-5 p-5 text-center">
      <h2 className="mb-1 font-bold">Toss</h2>
      <p className="mb-4 text-sm muted">Flip the coin, then record who won and what they chose.</p>

      {/* Coin */}
      <div className="mb-4 flex justify-center">
        <div
          className={`grid h-24 w-24 place-items-center rounded-full text-lg font-extrabold text-white shadow-lg ${
            flipping ? "coin-flip" : ""
          } ${face === "TAILS" ? "bg-amber-500" : "bg-pitch-500"}`}
        >
          {flipping ? "…" : face ?? "🪙"}
        </div>
      </div>
      <button className="btn-ghost mb-4" onClick={flip} disabled={flipping}>
        {flipping ? "Flipping…" : face ? "Flip again" : "Flip coin"}
      </button>

      {/* Result entry — enabled once the coin has been flipped. */}
      {face && (
        <div className="space-y-3 text-left">
          <div>
            <span className="mb-1 block text-xs font-semibold muted">Toss won by</span>
            <div className="grid grid-cols-2 gap-2">
              {[match.team_a_id, match.team_b_id].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWinner(id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    winner === id ? "border-pitch-500 bg-pitch-500 text-white" : ""
                  }`}
                  style={{ borderColor: winner === id ? undefined : "var(--border)" }}
                >
                  {teamName(teams, id)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold muted">Chose to</span>
            <div className="grid grid-cols-2 gap-2">
              {(["BAT", "BOWL"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDecision(d)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    decision === d ? "border-pitch-500 bg-pitch-500 text-white" : ""
                  }`}
                  style={{ borderColor: decision === d ? undefined : "var(--border)" }}
                >
                  {d === "BAT" ? "Bat first" : "Bowl first"}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary w-full" onClick={confirm} disabled={!winner || saving}>
            {saving ? "Saving…" : "Confirm toss"}
          </button>
        </div>
      )}
    </div>
  );
}
