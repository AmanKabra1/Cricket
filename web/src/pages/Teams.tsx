import { Link } from "react-router-dom";
import { useTeams } from "@/api/hooks";
import Spinner, { ErrorState, EmptyState } from "@/components/Spinner";

export default function Teams() {
  const { data, isLoading, isError } = useTeams();
  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState />;
  if (!data.length) return <EmptyState message="No teams registered yet." />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Teams</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((t) => (
          <Link key={t.id} to={`/teams/${t.id}`} className="card-surface flex items-center gap-3 p-4 transition hover:shadow-lg">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-pitch-100 text-base font-bold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
              {t.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm muted">{t.city ?? "—"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
