import { useMemo } from "react";
import { useTeams } from "@/api/hooks";
import type { Team } from "@/types";

export function useTeamMap() {
  const { data } = useTeams();
  return useMemo(() => {
    const m = new Map<number, Team>();
    (data ?? []).forEach((team: Team) => m.set(team.id, team));
    return m;
  }, [data]);
}

export function teamName(map: Map<number, Team>, id: number | null): string {
  if (id == null) return "TBD";
  return map.get(id)?.name ?? `Team ${id}`;
}
