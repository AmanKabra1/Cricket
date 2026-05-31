import { io, type Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "";

let socket: Socket | null = null;

/** Lazily create the shared Socket.IO connection. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
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
