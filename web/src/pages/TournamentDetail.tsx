import { useParams } from "react-router-dom";
import { useStandings, useTournamentMatches, useTournaments } from "@/api/hooks";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import Spinner, { ErrorState } from "@/components/Spinner";

export default function TournamentDetail() {
  const { id } = useParams();
  const tid = Number(id);
  const { data: tournaments } = useTournaments();
  const { data: standings, isLoading, isError } = useStandings(tid);
  const { data: matches } = useTournamentMatches(tid);
  const teams = useTeamMap();
  const tournament = tournaments?.find((t) => t.id === tid);

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
