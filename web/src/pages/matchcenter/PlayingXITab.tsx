import type { ReactNode } from "react";
import { useTeam } from "@/api/hooks";
import Spinner from "@/components/Spinner";
import type { Match } from "@/types";

function RoleTag({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 rounded bg-pitch-100 px-1.5 text-xs font-bold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
      {children}
    </span>
  );
}

function Squad({ teamId }: { teamId: number }) {
  const { data, isLoading } = useTeam(teamId);
  if (isLoading) return <Spinner />;
  if (!data) return null;
  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 font-bold">{data.name}</h3>
      <ul className="space-y-2">
        {data.players.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>
              <span className="mr-2 muted">{p.jersey_number ?? "–"}</span>
              {p.name}
              {data.captain_id === p.id && <RoleTag>C</RoleTag>}
              {data.vice_captain_id === p.id && <RoleTag>VC</RoleTag>}
              {data.wicket_keeper_id === p.id && <RoleTag>WK</RoleTag>}
            </span>
            <span className="text-xs muted">{p.role.replace("_", " ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PlayingXITab({ match }: { match: Match }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Squad teamId={match.team_a_id} />
      <Squad teamId={match.team_b_id} />
    </div>
  );
}
