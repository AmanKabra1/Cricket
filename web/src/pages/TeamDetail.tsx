import { useParams } from "react-router-dom";
import { useTeam } from "@/api/hooks";
import Spinner, { ErrorState } from "@/components/Spinner";

export default function TeamDetail() {
  const { id } = useParams();
  const { data, isLoading, isError } = useTeam(Number(id));
  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState />;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-pitch-100 text-xl font-black text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
          {data.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="muted">
            {data.city ?? "—"} {data.coach ? `· Coach: ${data.coach}` : ""}
          </p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold">Squad ({data.players.length})</h2>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left muted">
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">#</th>
              <th className="p-3">Player</th>
              <th className="p-3">Role</th>
              <th className="p-3">Batting</th>
              <th className="p-3">Bowling</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3 muted">{p.jersey_number ?? "—"}</td>
                <td className="p-3 font-medium">
                  {p.name}
                  {data.captain_id === p.id && (
                    <span className="ml-2 rounded bg-pitch-100 px-1.5 text-xs font-bold text-pitch-700">C</span>
                  )}
                </td>
                <td className="p-3">{p.role.replace("_", " ")}</td>
                <td className="p-3 muted">{p.batting_style.replace("_", " ")}</td>
                <td className="p-3 muted">{p.bowling_style.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
