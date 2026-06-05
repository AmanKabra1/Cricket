import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, get } from "@/lib/api";
import type { Match, Player, Team, Tournament, User } from "@/types";

export interface Venue {
  id: number;
  name: string;
  city: string | null;
}
export interface StandingRow {
  team_id: number;
  team_name: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  net_run_rate: number;
}

const detail = (e: any): string => {
  const d = e?.response?.data?.detail;
  // FastAPI/Pydantic 422 returns detail as an array of {type,loc,msg,...} objects.
  // Always coerce to a string so it can't be rendered as a React child (crash).
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg ?? String(x)).join("; ");
  if (d && typeof d === "object") return d.msg ?? JSON.stringify(d);
  return e?.response ? "Request failed" : "Can't reach the server";
};

// ---------- Lists ----------
export const useMatches = () =>
  useQuery({ queryKey: ["matches"], queryFn: () => get<Match[]>("/matches") });
export const useVenues = () =>
  useQuery({ queryKey: ["venues"], queryFn: () => get<Venue[]>("/venues") });
export const useUsers = () =>
  useQuery({ queryKey: ["users"], queryFn: () => get<User[]>("/admin/users") });
export const useTournamentsAdmin = () =>
  useQuery({ queryKey: ["tournaments", true], queryFn: () => get<Tournament[]>("/tournaments?mine=true") });
export const useStandings = (id: number, enabled = true) =>
  useQuery({ queryKey: ["standings", id], queryFn: () => get<StandingRow[]>(`/tournaments/${id}/standings`), enabled });
export const useTournamentMatches = (id: number) =>
  useQuery({ queryKey: ["tournament-matches", id], queryFn: () => get<Match[]>(`/tournaments/${id}/matches`) });

// ---------- Teams & players ----------
export const useCreateTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; city?: string; coach?: string; logo_url?: string }) =>
      api.post<Team>("/teams", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
};
export const useDeleteTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => api.delete(`/teams/${teamId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
};
export const useUpdateTeam = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<Team>(`/teams/${teamId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team", teamId] });
    },
  });
};
export interface PlayerInput {
  name: string;
  role?: string;
  age?: number;
  batting_style?: string;
  bowling_style?: string;
  jersey_number?: number;
  photo_url?: string;
}
export const useAddPlayer = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlayerInput) => api.post<Player>(`/teams/${teamId}/players`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", teamId] }),
  });
};
export const useUpdatePlayer = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PlayerInput }) =>
      api.patch<Player>(`/teams/players/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", teamId] }),
  });
};
export const useDeletePlayer = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: number) => api.delete(`/teams/players/${playerId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", teamId] }),
  });
};

// ---------- Venues ----------
export const useCreateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; city: string }) => api.post("/venues", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
};
export const useDeleteVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/venues/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
};

// ---------- Matches ----------
export interface MatchInput {
  team_a_id: number;
  team_b_id: number;
  venue_id?: number;
  tournament_id?: number;
  scheduled_at?: string;
  overs_limit: number;
  admin_ids?: number[];
}
export const useCreateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MatchInput) => api.post<Match>("/matches", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
export const useUpdateMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { scheduled_at?: string; venue_id?: number | null; overs_limit?: number } }) =>
      api.patch<Match>(`/matches/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
export const useApproveMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: number) => api.post(`/matches/${matchId}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
export const useDeleteMatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: number) => api.delete(`/matches/${matchId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

// ---------- Tournaments ----------
export const useCreateTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; format: string; team_ids: number[] }) =>
      api.post<Tournament>("/tournaments", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
};
export const useUpdateTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<Tournament>(`/tournaments/${id}`, { name }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
};
export const useApproveTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/tournaments/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
};
export const useDeleteTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tournaments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};
export const useGenerateFixtures = (id: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { overs_limit?: number; venue_id?: number | null; start_at?: string | null; interval_minutes?: number; matches_per_day?: number } = {}) =>
      api.post(`/tournaments/${id}/fixtures`, opts).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

// ---------- Users ----------
export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; full_name: string; role: string }) =>
      api.post<User>("/admin/users", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
export const useSetUserRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => api.patch<User>(`/admin/users/${id}/role`, { role }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
export const useSetUserActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => api.patch<User>(`/admin/users/${id}/active`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/admin/users/${id}`),
    // Optimistically drop the row so it disappears at once and doesn't flicker
    // back while the list refetches; roll back if the delete fails.
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const prev = qc.getQueryData<User[]>(["users"]);
      qc.setQueryData<User[]>(["users"], (old) => (old ?? []).filter((u) => u.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(["users"], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
export const useTestEmail = () =>
  useMutation({ mutationFn: () => api.post<{ detail: string }>("/admin/test-email").then((r) => r.data) });

// ---------- Backgrounds (super admin) ----------
export type Backgrounds = Record<string, { light?: string | null; dark?: string | null }>;
export const useBackgrounds = () =>
  useQuery({ queryKey: ["backgrounds"], queryFn: () => get<Backgrounds>("/public/settings/backgrounds") });
export const useUpdateBackgrounds = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pages: Backgrounds) => api.put("/admin/settings/backgrounds", { pages }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backgrounds"] }),
  });
};

export { detail as errorDetail };
