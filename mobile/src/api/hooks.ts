import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import type {
  CommentaryItem,
  DashboardData,
  LiveScore,
  Match,
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

export const useTeams = () =>
  useQuery({ queryKey: ["teams"], queryFn: () => get<Team[]>("/teams") });

export const useTeam = (id: number) =>
  useQuery({ queryKey: ["team", id], queryFn: () => get<TeamDetail>(`/teams/${id}`) });

export const useTournaments = () =>
  useQuery({ queryKey: ["tournaments"], queryFn: () => get<Tournament[]>("/tournaments") });
