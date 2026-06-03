import { useState } from "react";
import { Text, View } from "react-native";
import { useTeam, useTeams } from "@/api/hooks";
import {
  errorDetail, useAddPlayer, useCreateTeam, useDeletePlayer, useDeleteTeam, useUpdateTeam,
} from "@/api/admin";
import { Screen, H1, Muted, Card, Btn, Field, Chip, Note } from "@/components/ui";
import { useTheme } from "@/theme";
import type { Team } from "@/types";

const ROLES = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];

export default function ManageTeams() {
  const t = useTheme();
  const { data: teams, isLoading } = useTeams();
  const create = useCreateTeam();
  const del = useDeleteTeam();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const addTeam = async () => {
    if (!name.trim()) return;
    try {
      const tm = await create.mutateAsync({ name: name.trim() });
      setName("");
      setSelected(tm.id);
    } catch (e) {
      setMsg(errorDetail(e));
    }
  };

  return (
    <Screen>
      <H1>Teams & players</H1>
      <Card>
        <Field label="New team name" value={name} onChangeText={setName} placeholder="e.g. Springfield Strikers" />
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

  if (!team) return <Note>Loading squad…</Note>;

  return (
    <View style={{ marginTop: 10 }}>
      <Field label="Player name" value={pname} onChangeText={setPname} placeholder="e.g. Rohit" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        {ROLES.map((r) => <Chip key={r} label={r.replace("_", " ")} selected={role === r} onPress={() => setRole(r)} />)}
      </View>
      <Btn label={addPlayer.isPending ? "Adding…" : "Add player"} onPress={async () => { if (pname.trim()) { await addPlayer.mutateAsync({ name: pname.trim(), role }); setPname(""); } }} disabled={addPlayer.isPending} />

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
