import { useParams } from "react-router-dom";
import { usePlayerStats } from "@/api/hooks";
import Spinner, { ErrorState } from "@/components/Spinner";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: "var(--surface-2, rgba(120,120,120,.08))" }}>
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide muted">{label}</div>
    </div>
  );
}

export default function PlayerDetail() {
  const { id } = useParams();
  const { data, isLoading, isError } = usePlayerStats(Number(id));
  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState />;

  const { player: p, batting: b, bowling: w, fielding: f } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        {p.photo_url ? (
          <img src={p.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-pitch-400 to-pitch-600 text-xl font-black text-white">
            {p.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="muted">
            {p.role.replace("_", " ")} · {p.batting_style.replace("_", " ")}
            {p.bowling_style && p.bowling_style !== "None" ? ` · ${p.bowling_style}` : ""}
          </p>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-bold">🏏 Batting</h2>
      <div className="card-surface mb-6 grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
        <Stat label="Mat" value={b.matches} />
        <Stat label="Inns" value={b.innings} />
        <Stat label="Runs" value={b.runs} />
        <Stat label="HS" value={b.high_score} />
        <Stat label="Avg" value={b.average ?? "—"} />
        <Stat label="SR" value={b.strike_rate} />
        <Stat label="NO" value={b.not_outs} />
        <Stat label="50s" value={b.fifties} />
        <Stat label="100s" value={b.hundreds} />
        <Stat label="4s" value={b.fours} />
        <Stat label="6s" value={b.sixes} />
        <Stat label="Balls" value={b.balls} />
      </div>

      <h2 className="mb-2 text-lg font-bold">🔴 Bowling</h2>
      <div className="card-surface mb-6 grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
        <Stat label="Overs" value={w.overs} />
        <Stat label="Runs" value={w.runs_conceded} />
        <Stat label="Wkts" value={w.wickets} />
        <Stat label="Best" value={w.best_wickets} />
        <Stat label="Econ" value={w.economy} />
        <Stat label="Avg" value={w.average ?? "—"} />
      </div>

      <h2 className="mb-2 text-lg font-bold">🧤 Fielding</h2>
      <div className="card-surface grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
        <Stat label="Catches" value={f.catches} />
      </div>
    </div>
  );
}
