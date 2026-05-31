import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalytics } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import Spinner, { EmptyState } from "@/components/Spinner";

export default function AnalyticsTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useAnalytics(matchId);
  const teams = useTeamMap();
  if (isLoading) return <Spinner />;
  if (!data || !data.innings.length) return <EmptyState message="Charts appear once overs are bowled." />;

  return (
    <div className="space-y-8">
      {data.innings.map((inn) => (
        <div key={inn.innings_number} className="card-surface p-5">
          <h3 className="mb-4 font-bold">{teamName(teams, inn.batting_team_id)} — over by over</h3>

          <div className="mb-2 text-sm muted">Manhattan (runs per over)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={inn.overs}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Bar dataKey="runs" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mb-2 mt-6 text-sm muted">Worm (cumulative runs)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={inn.overs}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
              <Line type="monotone" dataKey="cumulative" stroke="#039855" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
