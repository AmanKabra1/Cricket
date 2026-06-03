import { useState } from "react";
import { Text, View } from "react-native";
import { useTeam, useTeams } from "@/api/hooks";
import {
  errorDetail, useAddPlayer, useCreateTeam, useDeletePlayer, useDeleteTeam, useUpdateTeam,
} from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Chip, Note } from "@/components/ui";
import { ImageField } from "@/components/ImageField";
import { useTheme } from "@/theme";
import type { Team } from "@/types";

const ROLES = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
const BATTING = ["RIGHT_HAND", "LEFT_HAND"];
const BOWLING = ["Right-arm fast", "Right-arm medium", "Right-arm off-break", "Right-arm leg-break", "Left-arm fast", "Left-arm medium", "Left-arm orthodox"];
const bowls = (r: string) => r === "BOWLER" || r === "ALL_ROUNDER";

export default function ManageTeams() {
  const t = useTheme();
  const { data: teams, isLoading, refetch, isFetching } = useTeams();
  const create = useCreateTeam();
  const del = useDeleteTeam();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [coach, setCoach] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const addTeam = async () => {
    if (!name.trim()) return;
    try {
      const tm = await create.mutateAsync({
        name: name.trim(),
        city: city.trim() || undefined,
        coach: coach.trim() || undefined,
        logo_url: logoUrl || undefined,
      });
      setName(""); setCity(""); setCoach(""); setLogoUrl(null);
      setSelected(tm.id);
    } catch (e) {
      setMsg(errorDetail(e));
    }
  };

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <H1>Teams & players</H1>
      <Card>
        <Field label="New team name *" value={name} onChangeText={setName} placeholder="e.g. Springfield Strikers" />
        <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. Springfield" />
        <Field label="Coach" value={coach} onChangeText={setCoach} placeholder="e.g. A. Coach" />
        <ImageField label="Team logo" value={logoUrl} onChange={setLogoUrl} category="team_logo" />
        <Btn label={create.isPending ? "Creating…" : "Create team"} onPress={addTeam} disabled={create.isPending} />
        {msg && <Note tone="error">{msg}</Note>}
      </Card>

      {isLoading && <Note>Loading…</Note>}
      {(teams ?? []).map((tm: Team) => (
        <Card key={tm.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }} onPress={() => setSelected(selected === tm.id ? null : tm.id)}>
              {tm.name}
            </Text>
            <Text
              style={{ color: "#ef4444", fontWeight: "700" }}
              onPress={async () => { try { await del.mutateAsync(tm.id); } catch (e) { setMsg(errorDetail(e)); } }}
            >
              Delete
            </Text>
          </View>
          {selected === tm.id && <Squad teamId={tm.id} />}
          {selected !== tm.id && <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Tap the name to manage squad</Text>}
        </Card>
      ))}
      {!isLoading && !teams?.length && <Note>No teams yet.</Note>}
    </Screen>
  );
}

function Squad({ teamId }: { teamId: number }) {
  const t = useTheme();
  const { data: team } = useTeam(teamId);
  const addPlayer = useAddPlayer(teamId);
  const delPlayer = useDeletePlayer(teamId);
  const update = useUpdateTeam(teamId);
  const [pname, setPname] = useState("");
  const [role, setRole] = useState("BATSMAN");
  const [jersey, setJersey] = useState("");
  const [batting, setBatting] = useState("RIGHT_HAND");
  const [bowling, setBowling] = useState(BOWLING[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  if (!team) return <Note>Loading squad…</Note>;

  const submitPlayer = async () => {
    if (!pname.trim()) return;
    await addPlayer.mutateAsync({
      name: pname.trim(),
      role,
      batting_style: batting,
      bowling_style: bowls(role) ? bowling : "None",
      jersey_number: jersey ? Number(jersey) : undefined,
      photo_url: photoUrl || undefined,
    });
    setPname(""); setJersey(""); setPhotoUrl(null);
  };

  return (
    <View style={{ marginTop: 10 }}>
      <Field label="Player name" value={pname} onChangeText={setPname} placeholder="e.g. Rohit" />
      <Field label="Jersey number" value={jersey} onChangeText={setJersey} keyboardType="numeric" placeholder="e.g. 7" />
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Role</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
        {ROLES.map((r) => <Chip key={r} label={r.replace("_", " ")} selected={role === r} onPress={() => setRole(r)} />)}
      </View>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Batting</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
        {BATTING.map((bt) => <Chip key={bt} label={bt.replace("_", " ")} selected={batting === bt} onPress={() => setBatting(bt)} />)}
      </View>
      {bowls(role) && (
        <>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Bowling</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
            {BOWLING.map((bw) => <Chip key={bw} label={bw} selected={bowling === bw} onPress={() => setBowling(bw)} />)}
          </View>
        </>
      )}
      <ImageField label="Player photo" value={photoUrl} onChange={setPhotoUrl} category="player_photo" />
      <Btn label={addPlayer.isPending ? "Adding…" : "Add player"} onPress={submitPlayer} disabled={addPlayer.isPending} />

      <View style={{ marginTop: 10 }}>
        {team.players.map((p) => {
          const isC = team.captain_id === p.id;
          const isVC = (team as any).vice_captain_id === p.id;
          const isWK = (team as any).wicket_keeper_id === p.id;
          return (
            <View key={p.id} style={{ borderTopColor: t.border, borderTopWidth: 1, paddingVertical: 8 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>
                {p.name} {isC ? "🅒" : ""}{isVC ? " VC" : ""}{isWK ? " WK" : ""}
                <Text style={{ color: t.muted, fontSize: 12 }}>  · {p.role.replace("_", " ")}</Text>
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
                <Chip label="Make C" selected={isC} onPress={() => update.mutate({ captain_id: isC ? null : p.id })} />
                <Chip label="Make VC" selected={isVC} onPress={() => update.mutate({ vice_captain_id: isVC ? null : p.id })} />
                <Chip label="Make WK" selected={isWK} onPress={() => update.mutate({ wicket_keeper_id: isWK ? null : p.id })} />
                <Chip label="Remove" selected={false} onPress={() => delPlayer.mutate(p.id)} />
              </View>
            </View>
          );
        })}
        {!team.players.length && <Note>No players yet.</Note>}
      </View>
    </View>
  );
}
