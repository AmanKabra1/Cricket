import { useCommentary } from "@/api/hooks";
import Spinner, { EmptyState } from "@/components/Spinner";

export default function CommentaryTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useCommentary(matchId);
  if (isLoading) return <Spinner />;
  if (!data || !data.length) return <EmptyState message="No commentary yet." />;

  return (
    <div className="card-surface divide-y" style={{ borderColor: "var(--border)" }}>
      {data.map((c, i) => (
        <div key={i} className="flex gap-3 p-4" style={{ borderColor: "var(--border)" }}>
          <span
            className={`grid h-8 w-12 shrink-0 place-items-center rounded-lg text-xs font-bold ${
              c.is_wicket
                ? "bg-red-500/15 text-red-500"
                : c.runs >= 4
                ? "bg-pitch-100 text-pitch-700 dark:bg-navy-700 dark:text-pitch-300"
                : "bg-slate-500/10 muted"
            }`}
          >
            {c.over}.{c.ball}
          </span>
          <p className="text-sm">{c.text}</p>
        </div>
      ))}
    </div>
  );
}
