import { useTeam } from "@/api/hooks";
import Spinner from "@/components/Spinner";
import type { Match } from "@/types";

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
