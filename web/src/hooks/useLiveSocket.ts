import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket, subscribeMatch, unsubscribeMatch } from "@/lib/socket";
import type { LiveScore } from "@/types";

/**
 * Subscribe to realtime updates for a match. On each pushed event we update the
 * live-score cache directly (instant) and invalidate the derived views so they
 * refetch — no polling required.
 */
export function useLiveSocket(matchId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!matchId) return;
    const socket = getSocket();
    subscribeMatch(matchId);

    const onScore = (payload: LiveScore) => {
      qc.setQueryData(["live", matchId], payload);
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
      qc.invalidateQueries({ queryKey: ["analytics", matchId] });
    };
    const onCommentary = () => qc.invalidateQueries({ queryKey: ["commentary", matchId] });
    const onStatus = () => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      qc.invalidateQueries({ queryKey: ["live", matchId] });
    };

    socket.on("score_update", onScore);
    socket.on("commentary", onCommentary);
    socket.on("match_status", onStatus);

    return () => {
      socket.off("score_update", onScore);
      socket.off("commentary", onCommentary);
      socket.off("match_status", onStatus);
      unsubscribeMatch(matchId);
    };
  }, [matchId, qc]);
}
