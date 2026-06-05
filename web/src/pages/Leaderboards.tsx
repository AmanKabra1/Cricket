import { Link } from "react-router-dom";
import { useLeaderboards, type LeaderRow } from "@/api/hooks";
import Spinner, { ErrorState, EmptyState } from "@/components/Spinner";

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) return <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pitch-400 to-pitch-600 text-xs font-bold text-white">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Board({ title, unit, rows }: { title: string; unit: string; rows: LeaderRow[] }) {
  return (
    <div className="card-surface p-5">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="muted text-sm">No data yet.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.player_id}>
              <Link to={`/players/${r.player_id}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-pitch-500/10">
                <span className={`w-5 text-center text-sm font-bold ${i === 0 ? "text-pitch-600" : "muted"}`}>{i + 1}</span>
                <Avatar name={r.name} photo={r.photo_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block truncate text-xs muted">{r.team_name} · {r.matches} match{r.matches === 1 ? "" : "es"}</span>
                </span>
                <span className="text-right">
                  <span className="text-lg font-extrabold leading-none text-pitch-600">{r.value}</span>
                  <span className="ml-1 text-xs muted">{unit}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Leaderboards() {
  const { data, isLoading, isError } = useLeaderboards();
  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState />;
  const empty = !data.top_run_scorers.length && !data.top_wicket_takers.length;
  if (empty) return <EmptyState message="No player stats yet — they appear once matches are scored." />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Leaderboards</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Board title="⭐ MVP (impact)" unit="pts" rows={data.mvps} />
        <Board title="🏏 Most runs" unit="runs" rows={data.top_run_scorers} />
        <Board title="🔴 Most wickets" unit="wkts" rows={data.top_wicket_takers} />
      </div>
    </div>
  );
}
