import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tokenStore } from "@/lib/api";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import TopProgressBar from "@/components/TopProgressBar";
import ScreenBackground from "@/components/ScreenBackground";
import { ThemeProvider, useTheme } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootInner />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function RootInner() {
  const t = useTheme();

  useEffect(() => {
    tokenStore.load();
  }, []);
  usePushRegistration();

  return (
    <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ScreenBackground />
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.surface },
            headerTitleStyle: { color: t.text },
            headerTintColor: t.primary,
            contentStyle: { backgroundColor: "transparent" },
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
        </View>
    </SafeAreaProvider>
  );
}
