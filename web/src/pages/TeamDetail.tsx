import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useTeam } from "@/api/hooks";
import Spinner, { ErrorState } from "@/components/Spinner";

function RoleTag({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 rounded bg-pitch-100 px-1.5 text-xs font-bold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
      {children}
    </span>
  );
}

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
      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left muted">
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Jersey</th>
              <th className="p-3">Player</th>
              <th className="p-3">Role</th>
              <th className="p-3">Batting</th>
              <th className="p-3">Bowling</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3">
                  {p.jersey_number != null
                    ? <span className="rounded bg-pitch-500/15 px-2 py-0.5 text-xs font-bold text-pitch-700 dark:text-pitch-300">#{p.jersey_number}</span>
                    : <span className="muted">—</span>}
                </td>
                <td className="p-3 font-medium">
                  <Link to={`/players/${p.id}`} className="hover:text-pitch-600 hover:underline">{p.name}</Link>
                  {data.captain_id === p.id && <RoleTag>C</RoleTag>}
                  {data.vice_captain_id === p.id && <RoleTag>VC</RoleTag>}
                  {data.wicket_keeper_id === p.id && <RoleTag>WK</RoleTag>}
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
