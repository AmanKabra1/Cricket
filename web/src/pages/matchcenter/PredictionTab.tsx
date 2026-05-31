import { usePrediction } from "@/api/hooks";
import Spinner from "@/components/Spinner";

export default function PredictionTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = usePrediction(matchId);
  if (isLoading) return <Spinner />;

  const available = data && data.available !== false;

  return (
    <div className="card-surface p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <h3 className="font-bold">AI match prediction</h3>
      </div>
      {!available ? (
        <p className="muted">
          {(data?.message as string) ??
            "AI predictions will appear here. The model trains on accumulated match data; once enough balls are recorded, win probability and projected scores show up live."}
        </p>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-slate-500/5 p-4 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <p className="mt-4 text-xs muted">
        Powered by the LocalScore AI service (XGBoost / LightGBM + LLM commentary). See roadmap Phase 4.
      </p>
    </div>
  );
}
