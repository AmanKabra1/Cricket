import { Link } from "react-router-dom";
import type { Match } from "@/types";

interface Slot {
  matchId?: number;
  a: number | null; // team id, or null = undecided
  b: number | null;
  winner?: number | null;
  real: boolean; // true = an actual scheduled match (round 1)
}

function roundLabel(idx: number, total: number): string {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round ${idx + 1}`;
}

/** Build round 1 from real matches, then project winners into later rounds. */
function buildRounds(matches: Match[]): Slot[][] {
  const round1: Slot[] = matches
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ matchId: m.id, a: m.team_a_id, b: m.team_b_id, winner: m.winner_team_id ?? null, real: true }));
  if (!round1.length) return [];

  const rounds: Slot[][] = [round1];
  let cur = round1;
  while (cur.length > 1) {
    const next: Slot[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const s1 = cur[i];
      const s2 = cur[i + 1];
      next.push({ a: s1?.winner ?? null, b: s2 ? s2.winner ?? null : null, real: false });
    }
    rounds.push(next);
    cur = next;
  }
  return rounds;
}

function TeamRow({ id, teams, winner }: { id: number | null; teams: Map<number, { name: string }>; winner: boolean }) {
  const name = id != null ? teams.get(id)?.name ?? `Team ${id}` : "TBD";
  return (
    <div className={`flex items-center justify-between px-3 py-2 text-sm ${winner ? "font-bold text-pitch-700 dark:text-pitch-300" : id == null ? "muted italic" : ""}`}>
      <span className="truncate">{name}</span>
      {winner && <span className="ml-2">🏆</span>}
    </div>
  );
}

export default function Bracket({ matches, teams }: { matches: Match[]; teams: Map<number, { name: string }> }) {
  const rounds = buildRounds(matches);
  if (!rounds.length) return <p className="muted">No bracket yet — generate fixtures first.</p>;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-6" style={{ minWidth: rounds.length * 220 }}>
        {rounds.map((round, ri) => (
          <div key={ri} className="flex min-w-[200px] flex-1 flex-col justify-around gap-4">
            <div className="text-xs font-bold uppercase tracking-wide muted">{roundLabel(ri, rounds.length)}</div>
            {round.map((slot, si) => {
              const inner = (
                <div className="card-surface divide-y overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <TeamRow id={slot.a} teams={teams} winner={slot.real && slot.winner != null && slot.winner === slot.a} />
                  <TeamRow id={slot.b} teams={teams} winner={slot.real && slot.winner != null && slot.winner === slot.b} />
                </div>
              );
              return slot.real && slot.matchId != null ? (
                <Link key={si} to={`/matches/${slot.matchId}`} className="block transition hover:opacity-80">{inner}</Link>
              ) : (
                <div key={si}>{inner}</div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
