import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/theme";

function icon(emoji: string) {
  return ({ color }: { color: string }) => <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        headerStyle: { backgroundColor: t.surface },
        headerTitleStyle: { color: t.text },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "LocalScore", tabBarLabel: "Home", tabBarIcon: icon("🏏") }} />
      <Tabs.Screen name="teams" options={{ title: "Teams", tabBarIcon: icon("👥") }} />
      <Tabs.Screen name="tournaments" options={{ title: "Tournaments", tabBarIcon: icon("🏆") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
