import { useRouter } from "expo-router";
import { useMe } from "@/api/auth";
import { Screen, H1, Muted, Card, Btn, Note } from "@/components/ui";
import { Text } from "react-native";
import { useTheme } from "@/theme";

export default function AdminHub() {
  const router = useRouter();
  const t = useTheme();
  const { data: me, isLoading } = useMe();

  if (isLoading) return <Screen><Note>Loading…</Note></Screen>;
  if (!me || me.role === "PUBLIC")
    return (
      <Screen>
        <H1>Manage</H1>
        <Note tone="error">Sign in as an admin to manage.</Note>
        <Btn label="Sign in" onPress={() => router.push("/login")} />
      </Screen>
    );

  const isSuper = me.role === "SUPER_ADMIN";

  return (
    <Screen>
      <H1>Manage</H1>
      <Muted>Signed in as {me.full_name} ({me.role.replace("_", " ").toLowerCase()})</Muted>

      <Card><Btn label="🏏 Teams & players" onPress={() => router.push("/admin/teams")} /></Card>
      <Card><Btn label="📅 Matches" onPress={() => router.push("/admin/matches")} /></Card>
      <Card><Btn label="🏆 Tournaments" onPress={() => router.push("/admin/tournaments")} /></Card>
      {isSuper && <Card><Btn label="👤 Admins (users)" onPress={() => router.push("/admin/users")} /></Card>}
      {isSuper && <Card><Btn label="🎨 Appearance (backgrounds)" onPress={() => router.push("/admin/appearance")} /></Card>}

      <Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>
        Tip: to score a match, open it from Home and tap “Score this match”.
      </Text>
    </Screen>
  );
}
