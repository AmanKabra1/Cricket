import { useQuery } from "@tanstack/react-query";
import { api, get, tokenStore } from "@/lib/api";
import type { User } from "@/types";

/** The signed-in user (or null). Reads /auth/me when a token is present. */
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<User | null> => {
      if (!tokenStore.current) return null;
      try {
        return await get<User>("/auth/me");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

export async function login(email: string, password: string): Promise<User> {
  const { data } = await api.post<{ access_token: string; refresh_token: string }>(
    "/auth/login",
    { email, password },
  );
  await tokenStore.set(data.access_token, data.refresh_token);
  return get<User>("/auth/me");
}

export async function logout(): Promise<void> {
  await tokenStore.clear();
}
