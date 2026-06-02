import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InningsScore, LiveScore, Match, Team } from "@/types";
import { teamName } from "@/hooks/useTeamMap";

const statusStyle: Record<string, string> = {
  LIVE: "badge-live",
  SCHEDULED: "text-pitch-600",
  COMPLETED: "muted",
  INNINGS_BREAK: "text-amber-500",
  ABANDONED: "muted",
};

/** Neutral calendar glyph — an emoji 📅 renders as a date-stamped image
 *  (e.g. "JUL 17") on Android, so we use a plain SVG that looks the same
 *  on every device. */
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchCard({ match, teams }: { match: Match; teams: Map<number, Team> }) {
  const live = match.status === "LIVE";
  // Show scores for any match that has been played — live, at the break, or
  // finished (Cricbuzz-style: completed cards show both innings + the result).
  const showScore = ["LIVE", "INNINGS_BREAK", "COMPLETED"].includes(match.status);

  const { data: score } = useQuery({
    queryKey: ["live", match.id],
    queryFn: async () => (await api.get<LiveScore>(`/public/matches/${match.id}/live`)).data,
    enabled: showScore,
    refetchInterval: live ? 12_000 : false,
  });

  const scoreFor = (teamId: number): string | null => {
    const inn = score?.innings.find((i: InningsScore) => i.batting_team_id === teamId);
    return inn ? `${inn.runs}/${inn.wickets}` : null;
  };
  const oversFor = (teamId: number): string | null => {
    const inn = score?.innings.find((i: InningsScore) => i.batting_team_id === teamId);
    return inn ? `${inn.overs} ov` : null;
  };

  return (
    <Link
      to={`/matches/${match.id}`}
      className="card-surface group block overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="mb-3 flex items-center justify-between">
        {/* A scheduled match whose time has arrived shows a pulsing "STARTING". */}
        {match.starting_soon && match.status === "SCHEDULED" ? (
          <span className="text-xs font-bold uppercase tracking-wide text-pitch-600">
            <span className="pulse-dot mr-1 inline-block align-middle" />
            Starting
          </span>
        ) : (
          <span className={`text-xs font-bold uppercase tracking-wide ${statusStyle[match.status] ?? "muted"}`}>
            {live && <span className="pulse-dot mr-1 inline-block align-middle" />}
            {match.status.replace("_", " ")}
          </span>
        )}
        <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-xs muted">{match.overs_limit} ov</span>
      </div>

      <TeamRow name={teamName(teams, match.team_a_id)} logo={teams.get(match.team_a_id)?.logo_url ?? null} score={scoreFor(match.team_a_id)} overs={oversFor(match.team_a_id)} />
      <div className="my-1 ml-9 text-xs font-semibold muted">vs</div>
      <TeamRow name={teamName(teams, match.team_b_id)} logo={teams.get(match.team_b_id)?.logo_url ?? null} score={scoreFor(match.team_b_id)} overs={oversFor(match.team_b_id)} />

      <div
        className="mt-3 flex items-center justify-between border-t pt-3 text-xs muted"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="inline-flex items-center gap-1.5"><CalendarIcon />{fmtDate(match.scheduled_at)}</span>
        <span className="font-medium">{match.result_text ?? (live ? "In progress →" : "")}</span>
      </div>
    </Link>
  );
}

function TeamRow({ name, logo, score, overs }: { name: string; logo: string | null; score: string | null; overs: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {logo ? (
        <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pitch-400 to-pitch-600 text-xs font-bold text-white">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="flex-1 truncate font-semibold">{name}</span>
      {score && (
        <span className="text-right">
          <span className="text-lg font-extrabold leading-none">{score}</span>
          {overs && <span className="ml-1 text-xs muted">{overs}</span>}
        </span>
      )}
    </div>
  );
}
