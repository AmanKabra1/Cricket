import { useMemo } from "react";
import { useTeams } from "@/api/hooks";
import type { Team } from "@/types";

/** Map of team id → team, for resolving names on match cards. */
export function useTeamMap() {
  const { data: teams } = useTeams();
  return useMemo(() => {
    const map = new Map<number, Team>();
    (teams ?? []).forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);
}

export function teamName(map: Map<number, Team>, id: number | null): string {
  if (id == null) return "TBD";
  return map.get(id)?.name ?? `Team ${id}`;
}
