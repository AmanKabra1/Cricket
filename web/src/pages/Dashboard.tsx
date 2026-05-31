import { useDashboard } from "@/api/hooks";
import { useTeamMap } from "@/hooks/useTeamMap";
import MatchCard from "@/components/MatchCard";
import Spinner, { ErrorState, EmptyState } from "@/components/Spinner";
import type { Match } from "@/types";

function Section({ title, matches, teams }: { title: string; matches: Match[]; teams: ReturnType<typeof useTeamMap> }) {
  if (!matches.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} teams={teams} />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError } = useDashboard();
  const teams = useTeamMap();

  if (isLoading) return <Spinner label="Loading matches…" />;
  if (isError || !data) return <ErrorState />;

  const empty = !data.live.length && !data.upcoming.length && !data.recent.length;

  return (
    <div>
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-pitch-600 to-navy-800 p-8 text-white shadow-card">
        <h1 className="text-3xl font-extrabold">Local cricket, live.</h1>
        <p className="mt-2 max-w-xl text-white/80">
          Ball-by-ball scores, full scorecards, commentary and AI insights for your local
          tournaments and grounds.
        </p>
      </div>

      {empty ? (
        <EmptyState message="No matches yet. Once an admin creates and scores a match, it shows up here live." />
      ) : (
        <>
          <Section title="🔴 Live now" matches={data.live} teams={teams} />
          <Section title="Upcoming" matches={data.upcoming} teams={teams} />
          <Section title="Recent results" matches={data.recent} teams={teams} />
        </>
      )}
    </div>
  );
}
