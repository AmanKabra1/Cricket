import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveScore, useMatch, useMatchBest } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useAppSelector } from "@/store";
import Spinner, { ErrorState } from "@/components/Spinner";
import Celebration from "@/components/Celebration";
import LiveTab from "./matchcenter/LiveTab";
import ScorecardTab from "./matchcenter/ScorecardTab";
import CommentaryTab from "./matchcenter/CommentaryTab";
import PlayingXITab from "./matchcenter/PlayingXITab";
import AnalyticsTab from "./matchcenter/AnalyticsTab";
import PredictionTab from "./matchcenter/PredictionTab";

const TABS = ["Live", "Scorecard", "Commentary", "Playing XI", "Analytics", "AI Prediction"] as const;
type Tab = (typeof TABS)[number];

export default function MatchCenter() {
  const { id } = useParams();
  const matchId = Number(id);
  const [tab, setTab] = useState<Tab>("Live");
  const { data: match, isLoading, isError } = useMatch(matchId);
  const { data: liveScore } = useLiveScore(matchId);
  const teams = useTeamMap();
  const user = useAppSelector((s) => s.auth.user);
  useLiveSocket(matchId);

  if (isLoading) return <Spinner />;
  if (isError || !match) return <ErrorState />;

  // "Need R off B balls" for an in-progress chase (2nd-innings target set).
  const chase = liveScore?.innings.find((i) => !i.is_closed && i.target != null);
  const oversToBalls = (o: string) => {
    const [a, b] = o.split(".").map(Number);
    return (a || 0) * 6 + (b || 0);
  };
  const chaseInfo =
    chase && chase.target != null
      ? {
          runs: Math.max(0, chase.target - chase.runs),
          balls: Math.max(0, match.overs_limit * 6 - oversToBalls(chase.overs)),
          team: teamName(teams, chase.batting_team_id),
        }
      : null;

  const live = match.status === "LIVE";
  const canScore = user && user.role !== "PUBLIC";
  const completed = match.status === "COMPLETED";
  const winnerId = match.winner_team_id;
  const { data: best } = useMatchBest(matchId);
  const potm = completed ? best?.player_of_match : null;

  return (
    <div>
      {/* Celebrate a finished match with a winner. */}
      <Celebration run={completed && !!winnerId} />
      {/* Header */}
      <div className="card-surface mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1">
              {live ? (
                <span className="badge-live"><span className="pulse-dot inline-block" /> Live</span>
              ) : (
                <span className="text-sm muted">{match.status.replace("_", " ")}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold">
              {teamName(teams, match.team_a_id)}
              {winnerId === match.team_a_id && <span title="Winner"> 🏆</span>}
              <span className="muted"> vs </span>
              {teamName(teams, match.team_b_id)}
              {winnerId === match.team_b_id && <span title="Winner"> 🏆</span>}
            </h1>
            <p className="text-sm muted">
              {match.overs_limit} overs
              {match.toss_winner_id &&
                ` · ${teamName(teams, match.toss_winner_id)} won the toss & chose to ${match.toss_decision?.toLowerCase()}`}
            </p>
            {match.result_text && <p className="mt-1 font-semibold text-pitch-600">{match.result_text}</p>}
            {potm && (
              <p className="mt-1 text-sm">
                <span className="muted">🏅 Player of the Match: </span>
                <Link to={`/players/${potm.player_id}`} className="font-semibold hover:underline">{potm.name}</Link>
                <span className="muted"> — {potm.line}</span>
              </p>
            )}
          </div>
          {canScore && match.approved !== false && match.status !== "COMPLETED" && match.status !== "ABANDONED" && (
            <Link to={`/admin/matches/${matchId}/score`} className="btn-primary">
              Score this match
            </Link>
          )}
        </div>
      </div>

      {/* Chase tracker — shown above every tab while a target is being chased. */}
      {chaseInfo && (
        <div className="mb-5 rounded-xl bg-pitch-500/10 p-3 text-center text-sm font-semibold text-pitch-700 dark:text-pitch-300">
          {chaseInfo.team} need <b>{chaseInfo.runs}</b> run{chaseInfo.runs === 1 ? "" : "s"} from{" "}
          <b>{chaseInfo.balls}</b> ball{chaseInfo.balls === 1 ? "" : "s"} to win
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t ? "border-pitch-500 text-pitch-600" : "border-transparent muted hover:text-pitch-500"
            }`}
          >
            {/* Once finished there's nothing "live" — label it Summary. */}
            {t === "Live" && (match.status === "COMPLETED" || match.status === "ABANDONED") ? "Summary" : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Live" && <LiveTab matchId={matchId} />}
      {tab === "Scorecard" && <ScorecardTab matchId={matchId} />}
      {tab === "Commentary" && <CommentaryTab matchId={matchId} />}
      {tab === "Playing XI" && <PlayingXITab match={match} />}
      {tab === "Analytics" && <AnalyticsTab matchId={matchId} />}
      {tab === "AI Prediction" && <PredictionTab matchId={matchId} />}
    </div>
  );
}
