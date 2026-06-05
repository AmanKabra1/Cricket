import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Analytics,
  CommentaryItem,
  DashboardData,
  LiveScore,
  Match,
  Scorecard,
  StandingRow,
  TeamDetail,
  Team,
  Tournament,
} from "@/types";

const get = async <T>(url: string): Promise<T> => (await api.get<T>(url)).data;

// ---- Public reads ----
export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<DashboardData>("/public/dashboard"),
    refetchInterval: 15_000,
  });

export const useMatch = (id: number) =>
  useQuery({ queryKey: ["match", id], queryFn: () => get<Match>(`/matches/${id}`) });

// Live views poll as a fallback so scores update without a manual refresh even
// if the WebSocket drops (e.g. free-tier / mobile networks). The socket still
// gives instant updates; this just guarantees freshness.
export const useLiveScore = (id: number) =>
  useQuery({
    queryKey: ["live", id],
    queryFn: () => get<LiveScore>(`/public/matches/${id}/live`),
    refetchInterval: 3000,
  });

export const useScorecard = (id: number) =>
  useQuery({
    queryKey: ["scorecard", id],
    queryFn: () => get<Scorecard>(`/public/matches/${id}/scorecard`),
    refetchInterval: 4000,
  });

export const useCommentary = (id: number) =>
  useQuery({
    queryKey: ["commentary", id],
    queryFn: () => get<CommentaryItem[]>(`/public/matches/${id}/commentary`),
    refetchInterval: 5000,
  });

export const useAnalytics = (id: number) =>
  useQuery({
    queryKey: ["analytics", id],
    queryFn: () => get<Analytics>(`/public/matches/${id}/analytics`),
  });

export const usePrediction = (id: number) =>
  useQuery({
    queryKey: ["prediction", id],
    queryFn: () => get<Record<string, unknown>>(`/public/matches/${id}/prediction`),
  });

export const useTeams = () =>
  useQuery({ queryKey: ["teams"], queryFn: () => get<Team[]>("/teams") });

export interface Venue {
  id: number;
  name: string;
  city: string;
  address: string | null;
  capacity: number | null;
}

export const useVenues = () =>
  useQuery({ queryKey: ["venues"], queryFn: () => get<Venue[]>("/venues") });

export const useBackgrounds = () =>
  useQuery({
    queryKey: ["backgrounds"],
    queryFn: () => get<Record<string, { light?: string | null; dark?: string | null }>>("/public/settings/backgrounds"),
    staleTime: 5 * 60_000,
  });

export const useTeam = (id: number) =>
  useQuery({ queryKey: ["team", id], queryFn: () => get<TeamDetail>(`/teams/${id}`) });

// `mine` = the admin-management view: super admins see all, match admins only
// the tournaments they created. Without it, the public list (approved only).
export const useTournaments = (mine = false) =>
  useQuery({
    queryKey: ["tournaments", mine],
    queryFn: () => get<Tournament[]>(`/tournaments${mine ? "?mine=true" : ""}`),
  });

export const useStandings = (id: number, enabled = true) =>
  useQuery({
    queryKey: ["standings", id],
    queryFn: () => get<StandingRow[]>(`/tournaments/${id}/standings`),
    enabled,
    refetchInterval: 15000, // keep the points table live while a match is on
  });

export const useTournamentMatches = (id: number) =>
  useQuery({
    queryKey: ["tournament-matches", id],
    queryFn: () => get<Match[]>(`/tournaments/${id}/matches`),
    refetchInterval: 15000,
  });

// ---- Player stats & leaderboards (Phase 9) ----
export interface PlayerCareer {
  player: { id: number; name: string; team_id: number; role: string; batting_style: string; bowling_style: string; photo_url: string | null; jersey_number: number | null };
  batting: { matches: number; innings: number; runs: number; balls: number; high_score: number; not_outs: number; fours: number; sixes: number; fifties: number; hundreds: number; average: number | null; strike_rate: number };
  bowling: { overs: string; runs_conceded: number; wickets: number; best_wickets: number; economy: number; average: number | null; strike_rate: number | null };
  fielding: { catches: number };
}
export interface LeaderRow { player_id: number; name: string; photo_url: string | null; team_name: string; value: number; matches: number }
export interface Leaderboards { top_run_scorers: LeaderRow[]; top_wicket_takers: LeaderRow[]; mvps: LeaderRow[] }
export interface BestPerformer { player_id: number; name: string; photo_url: string | null; team_name: string; line: string; impact: number }

export const usePlayerStats = (id: number) =>
  useQuery({ queryKey: ["player-stats", id], queryFn: () => get<PlayerCareer>(`/public/players/${id}/stats`), enabled: !!id });

export const useLeaderboards = () =>
  useQuery({ queryKey: ["leaderboards"], queryFn: () => get<Leaderboards>("/public/leaderboards") });

export const useTournamentLeaderboards = (id: number) =>
  useQuery({ queryKey: ["tournament-leaderboards", id], queryFn: () => get<Leaderboards>(`/public/tournaments/${id}/leaderboards`), enabled: !!id });

export const useMatchBest = (id: number) =>
  useQuery({ queryKey: ["match-best", id], queryFn: () => get<{ player_of_match: BestPerformer | null }>(`/public/matches/${id}/best`), enabled: !!id });

export const useMatches = (status?: string) =>
  useQuery({
    queryKey: ["matches", status ?? "all"],
    queryFn: () =>
      get<Match[]>(`/matches${status ? `?status_filter=${status}` : ""}`),
  });

// ---- Admin scoring mutations ----
export interface BallPayload {
  striker_id: number;
  non_striker_id: number;
  bowler_id: number;
  runs_batsman?: number;
  extra_type?: string;
  extra_runs?: number;
  is_wicket?: boolean;
  wicket_type?: string;
  dismissed_player_id?: number | null;
  fielder_id?: number | null;
  commentary?: string | null;
}

interface BallResult {
  ball_id: number;
  innings_closed: boolean;
  over_completed: boolean;
  live_score: LiveScore;
}

// Optimistic estimate of the score right after a delivery, so the number moves
// the instant the scorer taps (the server's authoritative value lands ~50ms later).
function applyBallOptimistically(prev: LiveScore, body: BallPayload): LiveScore {
  const innings = prev.innings.map((i) => ({ ...i }));
  const inn = [...innings].reverse().find((i) => !i.is_closed);
  if (!inn) return prev;
  const ex = body.extra_type ?? "NONE";
  const penalty = ex === "WIDE" || ex === "NO_BALL" ? 1 : 0;
  inn.runs += (body.runs_batsman ?? 0) + (body.extra_runs ?? 0) + penalty;
  if (body.is_wicket) inn.wickets += 1;
  if (ex === "NONE" || ex === "BYE" || ex === "LEG_BYE") {
    const [o, b] = inn.overs.split(".").map(Number);
    const balls = o * 6 + (b || 0) + 1;
    inn.overs = `${Math.floor(balls / 6)}.${balls % 6}`;
  }
  return { ...prev, innings };
}

export const usePostBall = (matchId: number) => {
  const qc = useQueryClient();
  return useMutation<BallResult, Error, BallPayload, { prev?: LiveScore }>({
    mutationFn: (body: BallPayload) =>
      api.post(`/matches/${matchId}/scoring/ball`, body).then((r) => r.data),
    onMutate: async (body) => {
      // Cancel in-flight refetches, snapshot, and optimistically bump the score.
      await qc.cancelQueries({ queryKey: ["live", matchId] });
      const prev = qc.getQueryData<LiveScore>(["live", matchId]);
      if (prev) qc.setQueryData(["live", matchId], applyBallOptimistically(prev, body));
      return { prev };
    },
    onError: (_e, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(["live", matchId], ctx.prev); // roll back
    },
    onSuccess: (data) => {
      // Replace the estimate with the server's authoritative score.
      if (data?.live_score) qc.setQueryData(["live", matchId], data.live_score);
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
      qc.invalidateQueries({ queryKey: ["commentary", matchId] });
      // The ball may have ended the innings/match — refresh match status so the
      // console flips to the result screen instead of a stale "innings break".
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // A completed match feeds the tournament points table — refresh it.
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["tournament-matches"] });
    },
  });
};

export const useUndoBall = (matchId: number) => {
  const qc = useQueryClient();
  return useMutation<{ undone: boolean; live_score: LiveScore }, Error, void>({
    mutationFn: () => api.post(`/matches/${matchId}/scoring/undo`).then((r) => r.data),
    onSuccess: (data) => {
      if (data?.live_score) qc.setQueryData(["live", matchId], data.live_score);
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["standings"] });
      qc.invalidateQueries({ queryKey: ["tournament-matches"] });
    },
  });
};
