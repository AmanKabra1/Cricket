import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMatch } from "@/api/hooks";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import { useAppSelector } from "@/store";
import Spinner, { ErrorState } from "@/components/Spinner";
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
  const teams = useTeamMap();
  const user = useAppSelector((s) => s.auth.user);
  useLiveSocket(matchId);

  if (isLoading) return <Spinner />;
  if (isError || !match) return <ErrorState />;

  const live = match.status === "LIVE";
  const canScore = user && user.role !== "PUBLIC";

  return (
    <div>
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
              {teamName(teams, match.team_a_id)} <span className="muted">vs</span> {teamName(teams, match.team_b_id)}
            </h1>
            <p className="text-sm muted">
              {match.overs_limit} overs
              {match.toss_winner_id &&
                ` · ${teamName(teams, match.toss_winner_id)} won the toss & chose to ${match.toss_decision?.toLowerCase()}`}
            </p>
            {match.result_text && <p className="mt-1 font-semibold text-pitch-600">{match.result_text}</p>}
          </div>
          {canScore && (
            <Link to={`/admin/matches/${matchId}/score`} className="btn-primary">
              Score this match
            </Link>
          )}
        </div>
      </div>

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
            {t}
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
