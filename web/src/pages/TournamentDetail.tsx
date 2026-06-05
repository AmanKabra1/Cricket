import { Link, useParams } from "react-router-dom";
import { useStandings, useTournamentLeaderboards, useTournamentMatches, useTournaments, type LeaderRow } from "@/api/hooks";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import Spinner, { ErrorState } from "@/components/Spinner";

function MiniBoard({ title, unit, rows }: { title: string; unit: string; rows: LeaderRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="card-surface p-4">
      <h3 className="mb-2 font-bold">{title}</h3>
      <ol className="space-y-1 text-sm">
        {rows.slice(0, 5).map((r, i) => (
          <li key={r.player_id}>
            <Link to={`/players/${r.player_id}`} className="flex items-center justify-between rounded p-1 hover:bg-pitch-500/10">
              <span className="truncate"><span className="mr-2 muted">{i + 1}</span>{r.name} <span className="text-xs muted">· {r.team_name}</span></span>
              <span className="font-bold text-pitch-600">{r.value}<span className="ml-1 text-xs muted">{unit}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function TournamentDetail() {
  const { id } = useParams();
  const tid = Number(id);
  const { data: tournaments } = useTournaments();
  const { data: standings, isLoading, isError } = useStandings(tid);
  const { data: matches } = useTournamentMatches(tid);
  const { data: lb } = useTournamentLeaderboards(tid);
  const teams = useTeamMap();
  const tournament = tournaments?.find((t) => t.id === tid);
  const mvp = lb?.mvps?.[0];

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{tournament?.name ?? "Tournament"}</h1>
      <p className="mb-5 muted">{tournament?.format.replace("_", " ")} · {tournament?.status}</p>

      <h2 className="mb-3 text-lg font-bold">Points table</h2>
      <div className="card-surface mb-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Team</th>
              <th className="p-3 text-center">P</th>
              <th className="p-3 text-center">W</th>
              <th className="p-3 text-center">L</th>
              <th className="p-3 text-center">T</th>
              <th className="p-3 text-center">Pts</th>
              <th className="p-3 text-center">NRR</th>
            </tr>
          </thead>
          <tbody>
            {(standings ?? []).map((r) => (
              <tr key={r.team_id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3 font-medium">{r.team_name}</td>
                <td className="p-3 text-center">{r.played}</td>
                <td className="p-3 text-center">{r.won}</td>
                <td className="p-3 text-center">{r.lost}</td>
                <td className="p-3 text-center">{r.tied}</td>
                <td className="p-3 text-center font-bold text-pitch-600">{r.points}</td>
                <td className="p-3 text-center">{r.net_run_rate > 0 ? "+" : ""}{r.net_run_rate}</td>
              </tr>
            ))}
            {!standings?.length && (
              <tr><td className="p-4 muted" colSpan={7}>No standings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {mvp && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-pitch-600 to-navy-800 p-5 text-white shadow-card">
          <div className="text-xs font-bold uppercase tracking-wide text-white/70">⭐ Tournament MVP</div>
          <Link to={`/players/${mvp.player_id}`} className="text-2xl font-extrabold hover:underline">{mvp.name}</Link>
          <div className="text-sm text-white/80">{mvp.team_name} · {mvp.value} impact pts over {mvp.matches} match{mvp.matches === 1 ? "" : "es"}</div>
        </div>
      )}

      {lb && (lb.top_run_scorers.length > 0 || lb.top_wicket_takers.length > 0) && (
        <>
          <h2 className="mb-3 text-lg font-bold">Leaderboards</h2>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <MiniBoard title="⭐ MVP" unit="pts" rows={lb.mvps} />
            <MiniBoard title="🏏 Runs" unit="runs" rows={lb.top_run_scorers} />
            <MiniBoard title="🔴 Wickets" unit="wkts" rows={lb.top_wicket_takers} />
          </div>
        </>
      )}

      <h2 className="mb-3 text-lg font-bold">Fixtures</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(matches ?? []).map((m) => (
          <MatchCard key={m.id} match={m} teams={teams} />
        ))}
        {!matches?.length && <p className="muted">No fixtures generated yet.</p>}
      </div>
    </div>
  );
}
