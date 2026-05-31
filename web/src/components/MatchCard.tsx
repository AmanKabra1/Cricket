import { Link } from "react-router-dom";
import type { Match, Team } from "@/types";
import { teamName } from "@/hooks/useTeamMap";

const statusStyle: Record<string, string> = {
  LIVE: "badge-live",
  SCHEDULED: "text-pitch-600",
  COMPLETED: "muted",
  INNINGS_BREAK: "text-amber-500",
  ABANDONED: "muted",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchCard({ match, teams }: { match: Match; teams: Map<number, Team> }) {
  const live = match.status === "LIVE";
  return (
    <Link
      to={`/matches/${match.id}`}
      className="card-surface block p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={statusStyle[match.status] ?? "muted"}>
          {live && <span className="pulse-dot mr-1 inline-block align-middle" />}
          {match.status.replace("_", " ")}
        </span>
        <span className="text-xs muted">{match.overs_limit} overs</span>
      </div>

      <div className="space-y-2">
        <TeamRow name={teamName(teams, match.team_a_id)} />
        <div className="text-center text-xs font-semibold muted">vs</div>
        <TeamRow name={teamName(teams, match.team_b_id)} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs muted" style={{ borderColor: "var(--border)" }}>
        <span>{fmtDate(match.scheduled_at)}</span>
        <span>{match.result_text ?? (live ? "In progress" : "")}</span>
      </div>
    </Link>
  );
}

function TeamRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-pitch-100 text-xs font-bold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
        {name.slice(0, 2).toUpperCase()}
      </span>
      <span className="font-semibold">{name}</span>
    </div>
  );
}
