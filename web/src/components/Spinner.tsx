export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-pitch-500 border-t-transparent" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="card-surface p-6 text-center text-red-500">
      {message ?? "Something went wrong. Please try again."}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="card-surface p-8 text-center muted">{message}</div>;
}
