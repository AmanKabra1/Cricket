import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Red dot on the runs line at any over where a wicket fell (shows where teams lost batters).
function wicketDot(props: { cx?: number; cy?: number; index?: number; payload?: { wickets: number } }) {
  const { cx, cy, index, payload } = props;
  if (!payload || payload.wickets <= 0 || cx == null || cy == null) return <g key={index} />;
  return <circle key={index} cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />;
}
import { useAnalytics } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import Spinner, { EmptyState } from "@/components/Spinner";

const TEAM_COLORS = ["#16a34a", "#2563eb"];

// Tooltip for the Manhattan: "Over N — R runs · W wkt".
function ManhattanTip({ active, payload, label }: { active?: boolean; payload?: { payload: { runs: number; wickets: number } }[]; label?: number | string }) {
  if (!active || !payload?.length) return null;
  const o = payload[0].payload;
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="font-bold">Over {label}</div>
      <div>{o.runs} run{o.runs === 1 ? "" : "s"}{o.wickets ? ` · ${o.wickets} wkt` : ""}</div>
    </div>
  );
}

export default function AnalyticsTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useAnalytics(matchId);
  const teams = useTeamMap();
  if (isLoading) return <Spinner />;
  if (!data || !data.innings.length) return <EmptyState message="Charts appear once overs are bowled." />;

  // Merge both innings by over for a single side-by-side worm.
  const maxOvers = Math.max(...data.innings.map((i) => i.overs.length), 0);
  const comparison = Array.from({ length: maxOvers }, (_, idx) => {
    const row: Record<string, number | null> = { over: idx + 1 };
    data.innings.forEach((inn, k) => { row[`t${k}`] = inn.overs[idx]?.cumulative ?? null; });
    return row;
  });
  const cmpWidth = Math.max(320, maxOvers * 46);

  return (
    <div className="space-y-8">
      {/* Single worm comparing both teams' cumulative runs. */}
      <div className="card-surface p-5">
        <div className="mb-2 text-sm muted">Run comparison (cumulative)</div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: cmpWidth }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
                <YAxis stroke="var(--muted)" fontSize={12} width={28} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                <Legend />
                {data.innings.map((inn, k) => (
                  <Line key={inn.innings_number} type="monotone" dataKey={`t${k}`} name={teamName(teams, inn.batting_team_id)}
                    stroke={TEAM_COLORS[k % TEAM_COLORS.length]} strokeWidth={2.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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
                  <Tooltip content={<ManhattanTip />} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
                  <Bar dataKey="runs" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-2 mt-6 text-sm muted">Runs &amp; wickets (cumulative) — red marks where a wicket fell</div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: chartWidth }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={(() => { let cw = 0; return inn.overs.map((o) => ({ ...o, cwk: (cw += o.wickets) })); })()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="over" stroke="var(--muted)" fontSize={12} />
                  <YAxis yAxisId="r" stroke="var(--muted)" fontSize={12} width={28} />
                  <YAxis yAxisId="w" orientation="right" stroke="#ef4444" fontSize={12} width={24} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Legend />
                  <Line yAxisId="r" name="Runs" type="monotone" dataKey="cumulative" stroke="#039855" strokeWidth={2.5} dot={wicketDot} />
                  <Line yAxisId="w" name="Wickets" type="stepAfter" dataKey="cwk" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" dot={false} />
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
