import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "@/config";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket"],
    });
  }
  return socket;
}

export function subscribeMatch(matchId: number) {
  getSocket().emit("subscribe_match", { match_id: matchId });
}

export function unsubscribeMatch(matchId: number) {
  getSocket().emit("unsubscribe_match", { match_id: matchId });
}
