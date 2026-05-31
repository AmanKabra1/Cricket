import { Link } from "react-router-dom";
import { useTournaments } from "@/api/hooks";
import Spinner, { ErrorState, EmptyState } from "@/components/Spinner";

export default function Tournaments() {
  const { data, isLoading, isError } = useTournaments();
  if (isLoading) return <Spinner />;
  if (isError || !data) return <ErrorState />;
  if (!data.length) return <EmptyState message="No tournaments yet." />;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Tournaments</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.map((t) => (
          <Link key={t.id} to={`/tournaments/${t.id}`} className="card-surface p-5 transition hover:shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{t.name}</h3>
              <span className="rounded-full bg-pitch-100 px-2.5 py-0.5 text-xs font-semibold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
                {t.format.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-sm muted">Status: {t.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
