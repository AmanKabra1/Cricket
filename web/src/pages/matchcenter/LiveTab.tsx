import { useLiveScore } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import Spinner, { EmptyState } from "@/components/Spinner";

export default function LiveTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useLiveScore(matchId);
  const teams = useTeamMap();
  if (isLoading) return <Spinner />;
  if (!data || !data.innings.length)
    return <EmptyState message="The match hasn't started. Scores appear here ball-by-ball." />;

  return (
    <div className="space-y-4">
      {data.innings.map((inn) => (
        <div key={inn.innings_id} className="card-surface p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm muted">{teamName(teams, inn.batting_team_id)}</div>
              <div className="text-3xl font-extrabold">
                {inn.runs}/{inn.wickets}
                <span className="ml-2 text-base font-medium muted">({inn.overs} ov)</span>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="muted">CRR <b className="text-pitch-600">{inn.run_rate.toFixed(2)}</b></div>
              {inn.required_run_rate != null && (
                <div className="muted">RRR <b className="text-amber-500">{inn.required_run_rate.toFixed(2)}</b></div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm muted">
            <span>Extras: {inn.extras}</span>
            {inn.target != null && <span>Target: {inn.target}</span>}
            <span>{inn.is_closed ? "Innings closed" : "In progress"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
