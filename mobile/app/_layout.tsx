import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenStore } from "@/lib/api";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import TopProgressBar from "@/components/TopProgressBar";
import { useTheme } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

export default function RootLayout() {
  const t = useTheme();

  useEffect(() => {
    tokenStore.load();
  }, []);
  usePushRegistration();

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.surface },
            headerTitleStyle: { color: t.text },
            headerTintColor: t.primary,
            contentStyle: { backgroundColor: t.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]" options={{ title: "Match Centre" }} />
          <Stack.Screen name="tournament/[id]" options={{ title: "Tournament" }} />
          <Stack.Screen name="score/[id]" options={{ title: "Score" }} />
          <Stack.Screen name="login" options={{ title: "Sign in", presentation: "modal" }} />
          <Stack.Screen name="admin/index" options={{ title: "Manage" }} />
          <Stack.Screen name="admin/teams" options={{ title: "Teams & players" }} />
          <Stack.Screen name="admin/matches" options={{ title: "Matches" }} />
          <Stack.Screen name="admin/tournaments" options={{ title: "Tournaments" }} />
          <Stack.Screen name="admin/users" options={{ title: "Admins" }} />
          <Stack.Screen name="admin/appearance" options={{ title: "Appearance" }} />
        </Stack>
        <TopProgressBar />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
