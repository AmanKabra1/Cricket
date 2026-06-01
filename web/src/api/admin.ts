import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Match, Player, Team, Tournament, User } from "@/types";

// ---------- Users / admins (super-admin only) ----------
export const useUsers = () =>
  useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/admin/users")).data,
  });

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
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api.patch<User>(`/admin/users/${id}/role`, { role }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useSetUserActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch<User>(`/admin/users/${id}/active`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

// ---------- Teams & players ----------
export interface TeamInput {
  name: string;
  city?: string;
  coach?: string;
  logo_url?: string;
}

export const useCreateTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TeamInput) => api.post<Team>("/teams", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
};

export const useUpdateTeam = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<TeamInput> & { captain_id?: number }) =>
      api.patch<Team>(`/teams/${teamId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team", teamId] });
    },
  });
};

export interface PlayerInput {
  name: string;
  age?: number;
  batting_style?: string;
  bowling_style?: string;
  role?: string;
  jersey_number?: number;
  photo_url?: string;
}

export const useAddPlayer = (teamId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PlayerInput) =>
      api.post<Player>(`/teams/${teamId}/players`, body).then((r) => r.data),
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

export const useDeleteTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: number) => api.delete(`/teams/${teamId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
};

// ---------- Venues ----------
interface VenueInput {
  name: string;
  city: string;
  address?: string;
  capacity?: number;
}

export const useCreateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VenueInput) => api.post("/venues", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
};

export const useUpdateVenue = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: VenueInput & { id: number }) =>
      api.patch(`/venues/${id}`, body).then((r) => r.data),
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

// ---------- Tournaments ----------
export const useCreateTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      format: string;
      start_date?: string;
      end_date?: string;
      team_ids: number[];
    }) => api.post<Tournament>("/tournaments", body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
};

export const useGenerateFixtures = (tournamentId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tournaments/${tournamentId}/fixtures`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament-matches", tournamentId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
};

export const useApproveTournament = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tournamentId: number) =>
      api.post(`/tournaments/${tournamentId}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
};

// ---------- Image upload ----------
export type UploadCategory = "team_logo" | "player_photo" | "match_image";

export async function uploadImage(file: File, category: UploadCategory): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url: string }>(`/uploads/${category}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}
