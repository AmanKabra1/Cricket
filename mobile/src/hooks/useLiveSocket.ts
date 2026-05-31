import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket, subscribeMatch, unsubscribeMatch } from "@/lib/socket";
import type { LiveScore } from "@/types";

/** Subscribe to realtime match updates and push them into the query cache. */
export function useLiveSocket(matchId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!matchId) return;
    const socket = getSocket();
    subscribeMatch(matchId);

    const onScore = (payload: LiveScore) => {
      qc.setQueryData(["live", matchId], payload);
      qc.invalidateQueries({ queryKey: ["scorecard", matchId] });
    };
    const onCommentary = () => qc.invalidateQueries({ queryKey: ["commentary", matchId] });
    const onStatus = () => qc.invalidateQueries({ queryKey: ["match", matchId] });

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
