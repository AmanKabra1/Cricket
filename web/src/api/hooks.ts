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

export const useLiveScore = (id: number) =>
  useQuery({
    queryKey: ["live", id],
    queryFn: () => get<LiveScore>(`/public/matches/${id}/live`),
  });

export const useScorecard = (id: number) =>
  useQuery({
    queryKey: ["scorecard", id],
    queryFn: () => get<Scorecard>(`/public/matches/${id}/scorecard`),
  });

export const useCommentary = (id: number) =>
  useQuery({
    queryKey: ["commentary", id],
    queryFn: () => get<CommentaryItem[]>(`/public/matches/${id}/commentary`),
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

export const useTeam = (id: number) =>
  useQuery({ queryKey: ["team", id], queryFn: () => get<TeamDetail>(`/teams/${id}`) });

export const useTournaments = () =>
  useQuery({ queryKey: ["tournaments"], queryFn: () => get<Tournament[]>("/tournaments") });

export const useStandings = (id: number) =>
  useQuery({
    queryKey: ["standings", id],
    queryFn: () => get<StandingRow[]>(`/tournaments/${id}/standings`),
  });

export const useTournamentMatches = (id: number) =>
  useQuery({
    queryKey: ["tournament-matches", id],
    queryFn: () => get<Match[]>(`/tournaments/${id}/matches`),
  });

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

export const usePostBall = (matchId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BallPayload) =>
      api.post(`/matches/${matchId}/scoring/ball`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live", matchId] });
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
      qc.invalidateQueries({ queryKey: ["commentary", matchId] });
    },
  });
};

export const useUndoBall = (matchId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/matches/${matchId}/scoring/undo`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live", matchId] });
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
    },
  });
};
