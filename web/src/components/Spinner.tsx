export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-pitch-500 border-t-transparent" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card-surface p-6 text-center">
      <p className="text-red-500">{message ?? "Couldn't reach the server."}</p>
      <p className="mt-1 text-sm muted">The free server may be waking up (first load can take ~30–60s).</p>
      {onRetry && (
        <button className="btn-primary mt-4" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="card-surface p-8 text-center muted">{message}</div>;
}
