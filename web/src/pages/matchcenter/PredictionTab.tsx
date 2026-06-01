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
            "AI predictions are coming soon — win probability and projected scores will show up live here."}
        </p>
      ) : (
        <pre className="overflow-x-auto rounded-lg bg-slate-500/5 p-4 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <p className="mt-4 text-xs muted">🚧 This feature is under development.</p>
    </div>
  );
}
