import { Pressable, Text } from "react-native";
import { useFollows, useToggleFollow } from "@/api/follows";
import { useTheme } from "@/theme";

/**
 * Follow/unfollow a team or tournament to get push alerts about its matches.
 * Pass exactly one of teamId / tournamentId.
 */
export function FollowButton({ teamId, tournamentId }: { teamId?: number; tournamentId?: number }) {
  const t = useTheme();
  const { data: follows } = useFollows();
  const toggle = useToggleFollow();

  const following = teamId != null
    ? !!follows?.team_ids.includes(teamId)
    : tournamentId != null
      ? !!follows?.tournament_ids.includes(tournamentId)
      : false;

  const onPress = () => {
    const target = teamId != null ? { team_id: teamId } : { tournament_id: tournamentId! };
    toggle.mutate({ follow: !following, target });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={toggle.isPending}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: t.primary,
        backgroundColor: following ? t.primary : "transparent",
        opacity: pressed || toggle.isPending ? 0.7 : 1,
      })}
    >
      <Text style={{ color: following ? "#fff" : t.primary, fontWeight: "800" }}>
        {following ? "🔔 Following" : "🔕 Follow"}
      </Text>
    </Pressable>
  );
}
