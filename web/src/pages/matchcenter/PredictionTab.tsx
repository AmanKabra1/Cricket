import { usePrediction } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import Spinner from "@/components/Spinner";

export default function PredictionTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = usePrediction(matchId);
  const teams = useTeamMap();
  if (isLoading) return <Spinner />;

  const available = data && data.available !== false;

  if (!available) {
    return (
      <div className="card-surface p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="font-bold">AI match prediction</h3>
        </div>
        <p className="muted">
          {(data?.message as string) ??
            "Predictions appear here once the match is under way — win probability, projected score and a live read of the game."}
        </p>
      </div>
    );
  }

  const batId = data!.batting_team_id as number | null;
  const bowlId = data!.bowling_team_id as number | null;
  const batPct = Math.round(((data!.batting_win_probability as number) ?? 0.5) * 100);
  const bowlPct = 100 - batPct;
  const projected = data!.projected_score as number | null;
  const insight = data!.insight as string | null;
  const keyMoments = (data!.key_moments as string[]) ?? [];
  const model = (data!.model as string) ?? "heuristic";

  return (
    <div className="space-y-4">
      {/* AI insight */}
      <div className="card-surface p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="font-bold">AI match prediction</h3>
        </div>
        {insight && <p className="text-lg font-semibold text-pitch-600">{insight}</p>}
      </div>

      {/* Win probability */}
      <div className="card-surface p-5">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{batId ? teamName(teams, batId) : "Batting"} {batPct}%</span>
          <span className="muted">{bowlId ? teamName(teams, bowlId) : "Bowling"} {bowlPct}%</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-500/15">
          <div className="h-full bg-pitch-500" style={{ width: `${batPct}%` }} />
          <div className="h-full bg-amber-500" style={{ width: `${bowlPct}%` }} />
        </div>
        {projected != null && (
          <p className="mt-3 text-sm muted">
            Projected score: <span className="font-bold text-[var(--text)]">{projected}</span>
          </p>
        )}
      </div>

      {/* Key moments */}
      {keyMoments.length > 0 && (
        <div className="card-surface p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Key factors</div>
          <ul className="space-y-1 text-sm">
            {keyMoments.map((m, i) => (
              <li key={i} className="flex gap-2"><span className="text-pitch-500">•</span><span>{m}</span></li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs muted">
        Powered by LocalScore AI · {model === "heuristic" ? "live model" : model}
      </p>
    </div>
  );
}
