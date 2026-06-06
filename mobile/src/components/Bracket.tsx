import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme";
import { teamName } from "@/hooks/useTeamMap";
import type { Match, Team } from "@/types";

interface Slot {
  matchId?: number;
  a: number | null;
  b: number | null;
  winner?: number | null;
  real: boolean;
}

function roundLabel(idx: number, total: number): string {
  const fromEnd = total - 1 - idx;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round ${idx + 1}`;
}

function buildRounds(matches: Match[]): Slot[][] {
  const round1: Slot[] = matches
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ matchId: m.id, a: m.team_a_id, b: m.team_b_id, winner: m.winner_team_id ?? null, real: true }));
  if (!round1.length) return [];
  const rounds: Slot[][] = [round1];
  let cur = round1;
  while (cur.length > 1) {
    const next: Slot[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const s1 = cur[i];
      const s2 = cur[i + 1];
      next.push({ a: s1?.winner ?? null, b: s2 ? s2.winner ?? null : null, real: false });
    }
    rounds.push(next);
    cur = next;
  }
  return rounds;
}

export function Bracket({ matches, teams }: { matches: Match[]; teams: Map<number, Team> }) {
  const t = useTheme();
  const router = useRouter();
  const rounds = buildRounds(matches);
  if (!rounds.length) return null;

  const Row = ({ id, win }: { id: number | null; win: boolean }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text numberOfLines={1} style={{ color: id == null ? t.muted : win ? t.primary : t.text, fontWeight: win ? "800" : "500", fontStyle: id == null ? "italic" : "normal", flex: 1 }}>
        {id != null ? teamName(teams, id) : "TBD"}
      </Text>
      {win && <Text style={{ marginLeft: 4 }}>🏆</Text>}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {rounds.map((round, ri) => (
          <View key={ri} style={{ width: 170, justifyContent: "space-around", gap: 12 }}>
            <Text style={{ color: t.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 2 }}>
              {roundLabel(ri, rounds.length)}
            </Text>
            {round.map((slot, si) => {
              const card = (
                <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 10, overflow: "hidden" }}>
                  <Row id={slot.a} win={slot.real && slot.winner != null && slot.winner === slot.a} />
                  <View style={{ height: 1, backgroundColor: t.border }} />
                  <Row id={slot.b} win={slot.real && slot.winner != null && slot.winner === slot.b} />
                </View>
              );
              return slot.real && slot.matchId != null ? (
                <Pressable key={si} onPress={() => router.push(`/match/${slot.matchId}`)}>{card}</Pressable>
              ) : (
                <View key={si}>{card}</View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
