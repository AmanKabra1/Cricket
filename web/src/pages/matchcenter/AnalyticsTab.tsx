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
      {data.innings.map((inn) => {
        // Give charts room per over and let them scroll horizontally when an
        // innings has many overs (so bars/labels don't get crushed on mobile).
        const chartWidth = Math.max(320, inn.overs.length * 46);
        const total = inn.overs.length ? inn.overs[inn.overs.length - 1].cumulative : 0;
        const wkts = inn.overs.reduce((s: number, o: { wickets: number }) => s + o.wickets, 0);
        const oversBowled = inn.overs.length;
        return (
        <div key={inn.innings_number} className="card-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="font-bold">{teamName(teams, inn.batting_team_id)}</h3>
            <span className="text-2xl font-extrabold">{total}/{wkts}</span>
            <span className="text-sm muted">{oversBowled} ov · RR {(total / Math.max(1, oversBowled)).toFixed(2)}</span>
          </div>

          <div className="mb-2 text-sm muted">Manhattan (runs per over)</div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: chartWidth }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={inn.overs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} width={28} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="runs" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-2 mt-6 text-sm muted">Worm (cumulative runs)</div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: chartWidth }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={inn.overs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
                  <YAxis stroke="var(--muted)" fontSize={12} width={28} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="cumulative" stroke="#039855" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
