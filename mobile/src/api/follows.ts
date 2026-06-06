import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, get } from "@/lib/api";
import { getPushToken } from "@/lib/pushToken";

interface Follows {
  team_ids: number[];
  tournament_ids: number[];
}

/** This device's followed teams/tournaments (empty if push isn't set up). */
export function useFollows() {
  return useQuery({
    queryKey: ["follows"],
    queryFn: async (): Promise<Follows> => {
      const token = await getPushToken();
      if (!token) return { team_ids: [], tournament_ids: [] };
      return get<Follows>(`/push/follows?token=${encodeURIComponent(token)}`);
    },
  });
}

type Target = { team_id: number } | { tournament_id: number };

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ follow, target }: { follow: boolean; target: Target }) => {
      const token = await getPushToken();
      if (!token) throw new Error("Enable notifications first (open the app on a real device).");
      await api.post(follow ? "/push/follow" : "/push/unfollow", { token, ...target });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["follows"] }),
  });
}
