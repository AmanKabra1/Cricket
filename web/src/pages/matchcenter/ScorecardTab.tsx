import { useScorecard } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import Spinner, { EmptyState } from "@/components/Spinner";
import type { InningsCard } from "@/types";

/** Player photo, or initials fallback when there's no image. */
function PlayerAvatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) {
    return <img src={photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pitch-400 to-pitch-600 text-[10px] font-bold text-white">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function InningsBlock({ inn, teams }: { inn: InningsCard; teams: Map<number, import("@/types").Team> }) {
  return (
    <div className="card-surface mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <h3 className="font-bold">{teamName(teams, inn.batting_team_id)}</h3>
        <span className="font-bold">{inn.runs}/{inn.wickets} ({inn.overs})</span>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-sm">
        <thead className="text-left">
          <tr className="bg-pitch-500/15 text-pitch-700 dark:text-pitch-300">
            <th className="p-3 font-bold">🏏 Batting</th>
            <th className="p-3 text-center">R</th>
            <th className="p-3 text-center">B</th>
            <th className="p-3 text-center">4s</th>
            <th className="p-3 text-center">6s</th>
            <th className="p-3 text-center">SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batting.map((b) => (
            <tr key={b.player_id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-3 font-medium">
                <span className="flex items-center gap-2">
                  <PlayerAvatar name={b.name} photo={b.photo_url} />
                  <span>{b.name} {!b.is_out && <span className="text-xs text-pitch-600">not out</span>}</span>
                </span>
              </td>
              <td className="p-3 text-center font-semibold">{b.runs}</td>
              <td className="p-3 text-center">{b.balls}</td>
              <td className="p-3 text-center">{b.fours}</td>
              <td className="p-3 text-center">{b.sixes}</td>
              <td className="p-3 text-center muted">{b.strike_rate.toFixed(1)}</td>
            </tr>
          ))}
          {!inn.batting.length && <tr><td className="p-3 muted" colSpan={6}>Yet to bat.</td></tr>}
        </tbody>
      </table>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="text-left">
          <tr className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <th className="p-3 font-bold">🎯 Bowling</th>
            <th className="p-3 text-center">O</th>
            <th className="p-3 text-center">R</th>
            <th className="p-3 text-center">W</th>
            <th className="p-3 text-center">Econ</th>
          </tr>
        </thead>
        <tbody>
          {inn.bowling.map((b) => (
            <tr key={b.player_id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-3 font-medium">
                <span className="flex items-center gap-2">
                  <PlayerAvatar name={b.name} photo={b.photo_url} />
                  <span>{b.name}</span>
                </span>
              </td>
              <td className="p-3 text-center">{b.overs}</td>
              <td className="p-3 text-center">{b.runs_conceded}</td>
              <td className="p-3 text-center font-semibold">{b.wickets}</td>
              <td className="p-3 text-center muted">{b.economy.toFixed(2)}</td>
            </tr>
          ))}
          {!inn.bowling.length && <tr><td className="p-3 muted" colSpan={5}>—</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function ScorecardTab({ matchId }: { matchId: number }) {
  const { data, isLoading } = useScorecard(matchId);
  const teams = useTeamMap();
  if (isLoading) return <Spinner />;
  if (!data || !data.innings.length) return <EmptyState message="No scorecard yet." />;
  return (
    <div>
      {data.innings.map((inn) => (
        <InningsBlock key={inn.innings_id} inn={inn} teams={teams} />
      ))}
    </div>
  );
}
