import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type {
  Analytics,
  CommentaryItem,
  DashboardData,
  LiveScore,
  Match,
  Prediction,
  Scorecard,
  Team,
  TeamDetail,
  Tournament,
} from "@/types";

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => get<DashboardData>("/public/dashboard"),
    refetchInterval: 15_000,
  });

export const useMatch = (id: number) =>
  useQuery({ queryKey: ["match", id], queryFn: () => get<Match>(`/matches/${id}`) });

export const useLiveScore = (id: number) =>
  useQuery({ queryKey: ["live", id], queryFn: () => get<LiveScore>(`/public/matches/${id}/live`) });

export const useScorecard = (id: number) =>
  useQuery({ queryKey: ["scorecard", id], queryFn: () => get<Scorecard>(`/public/matches/${id}/scorecard`) });

export const useCommentary = (id: number) =>
  useQuery({ queryKey: ["commentary", id], queryFn: () => get<CommentaryItem[]>(`/public/matches/${id}/commentary`) });

export const usePrediction = (id: number) =>
  useQuery({ queryKey: ["prediction", id], queryFn: () => get<Prediction>(`/public/matches/${id}/prediction`), refetchInterval: 10_000 });

export const useAnalytics = (id: number) =>
  useQuery({ queryKey: ["analytics", id], queryFn: () => get<Analytics>(`/public/matches/${id}/analytics`), refetchInterval: 10_000 });

export const useTeams = () =>
  useQuery({ queryKey: ["teams"], queryFn: () => get<Team[]>("/teams") });

export const useTeam = (id: number) =>
  useQuery({ queryKey: ["team", id], queryFn: () => get<TeamDetail>(`/teams/${id}`) });

export const useTournaments = () =>
  useQuery({ queryKey: ["tournaments"], queryFn: () => get<Tournament[]>("/tournaments") });

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
