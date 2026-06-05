import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTeams } from "@/api/hooks";
import { useMe } from "@/api/auth";
import { teamName, useTeamMap } from "@/hooks/useTeamMap";
import {
  errorDetail, useApproveMatch, useCreateMatch, useCreateVenue, useDeleteMatch,
  useDeleteVenue, useMatches, useTournamentsAdmin, useUpdateMatch, useUsers, useVenues,
} from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Chip, Note, Muted } from "@/components/ui";
import DateTimePicker from "@/components/DateTimePicker";
import { useTheme } from "@/theme";
import type { Match } from "@/types";

function defaultWhen() {
  // Default to the current date & time; the picker hides anything earlier.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ManageMatches() {
  const t = useTheme();
  const router = useRouter();
  const teamsMap = useTeamMap();
  const { data: teams } = useTeams();
  const { data: matches, isLoading, refetch, isFetching } = useMatches();
  const { data: venues } = useVenues();
  const { data: tournaments } = useTournamentsAdmin();
  const { data: users } = useUsers();
  const { data: me } = useMe();
  const isSuper = me?.role === "SUPER_ADMIN";
  const create = useCreateMatch();
  const approve = useApproveMatch();
  const del = useDeleteMatch();

  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [overs, setOvers] = useState("20");
  const [venue, setVenue] = useState<number | null>(null);
  const [tournament, setTournament] = useState<number | null>(null);
  const [admins, setAdmins] = useState<number[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [when, setWhen] = useState(defaultWhen());
  const [msg, setMsg] = useState<string | null>(null);

  const matchAdmins = (users ?? []).filter((u) => u.role === "MATCH_ADMIN" && u.is_active);
  const toggleAdmin = (id: number) => setAdmins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    setMsg(null);
    if (!a || !b || a === b) { setMsg("Pick two different teams."); return; }
    try {
      await create.mutateAsync({
        team_a_id: a, team_b_id: b,
        venue_id: venue ?? undefined,
        tournament_id: tournament ?? undefined,
        admin_ids: admins.length ? admins : undefined,
        overs_limit: Math.min(50, Math.max(1, Number(overs) || 20)),
        scheduled_at: when ? (when.length === 16 ? `${when}:00` : when) : undefined,
      });
      setMsg("Match created ✓");
      setA(null); setB(null); setTournament(null); setAdmins([]);
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <H1>Matches</H1>
      <Card>
        <Muted>Create match</Muted>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Team A</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
          {(teams ?? []).map((tm) => <Chip key={tm.id} label={tm.name} selected={a === tm.id} onPress={() => setA(tm.id)} />)}
        </View>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Team B</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
          {(teams ?? []).map((tm) => <Chip key={tm.id} label={tm.name} selected={b === tm.id} onPress={() => setB(tm.id)} />)}
        </View>
        <Field label="Overs" value={overs} onChangeText={setOvers} keyboardType="numeric" />
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Date & time</Text>
        <View style={{ marginBottom: 10 }}>
          <DateTimePicker value={when} onChange={setWhen} />
        </View>
        {!!venues?.length && (
          <>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Venue (optional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
              {venues.map((v) => <Chip key={v.id} label={v.name} selected={venue === v.id} onPress={() => setVenue(venue === v.id ? null : v.id)} />)}
            </View>
          </>
        )}
        {!!tournaments?.length && (
          <>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Tournament (optional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
              {tournaments.map((tn) => <Chip key={tn.id} label={tn.name} selected={tournament === tn.id} onPress={() => setTournament(tournament === tn.id ? null : tn.id)} />)}
            </View>
          </>
        )}
        {isSuper && !!matchAdmins.length && (
          <>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Assign scorers (optional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
              {matchAdmins.map((u) => <Chip key={u.id} label={u.full_name} selected={admins.includes(u.id)} onPress={() => toggleAdmin(u.id)} />)}
            </View>
          </>
        )}
        <Btn label={create.isPending ? "Creating…" : "Create match"} onPress={submit} loading={create.isPending} />
        {msg && <Note tone={msg.endsWith("✓") ? "ok" : "error"}>{msg}</Note>}
      </Card>

      <VenueManager />

      <H1>All matches</H1>
      {isLoading && <Note>Loading…</Note>}
      {(matches ?? []).map((m: Match) => {
        const done = m.status === "COMPLETED" || m.status === "ABANDONED";
        const tour = tournaments?.find((tn) => tn.id === m.tournament_id);
        const creator = users?.find((u) => u.id === m.created_by_id);
        return (
          <Card key={m.id}>
            {/* Tournament accent so tournament fixtures stand out for super admins. */}
            {tour && (
              <View style={{ alignSelf: "flex-start", backgroundColor: t.primary + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 }}>
                <Text style={{ color: t.primary, fontSize: 11, fontWeight: "800" }}>🏆 {tour.name}</Text>
              </View>
            )}
            <Text style={{ color: t.text, fontWeight: "700" }}>{teamName(teamsMap, m.team_a_id)} vs {teamName(teamsMap, m.team_b_id)}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {m.status.replace("_", " ")} · {m.overs_limit} ov{(m as any).approved === false ? " · Pending approval" : ""}
            </Text>
            {isSuper && (
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {creator ? `Created by ${creator.full_name}${creator.role === "SUPER_ADMIN" ? " 👑" : " 🛡️"}` : "Creator unknown"}
              </Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {/* Only a super admin can approve. A match admin sees a hint instead. */}
              {(m as any).approved === false && isSuper && <Chip label="Approve" selected={false} loading={approve.isPending && approve.variables === m.id} onPress={() => approve.mutate(m.id)} />}
              {(m as any).approved === false && !isSuper && <Text style={{ color: t.muted, fontSize: 12, marginRight: 8 }}>Awaiting super-admin approval to score</Text>}
              {!done && (m as any).approved !== false && <Chip label="Score" selected onPress={() => router.push(`/score/${m.id}`)} />}
              {done && <Chip label="View" selected={false} onPress={() => router.push(`/match/${m.id}`)} />}
              {m.status === "SCHEDULED" && <Chip label={editId === m.id ? "Close" : "Edit"} selected={false} onPress={() => setEditId(editId === m.id ? null : m.id)} />}
              <Chip label="Delete" selected={false} loading={del.isPending && del.variables === m.id} onPress={() => del.mutate(m.id)} />
            </View>
            {editId === m.id && <EditMatch match={m} venues={venues ?? []} onDone={() => setEditId(null)} />}
          </Card>
        );
      })}
    </Screen>
  );
}

// Inline edit of a scheduled match — date/time, venue, overs (teams locked).
function EditMatch({ match, venues, onDone }: { match: Match; venues: { id: number; name: string }[]; onDone: () => void }) {
  const t = useTheme();
  const update = useUpdateMatch();
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [when, setWhen] = useState(toLocal(match.scheduled_at));
  const [venue, setVenue] = useState<number | null>(match.venue_id ?? null);
  const [overs, setOvers] = useState(String(match.overs_limit));
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(null);
    try {
      await update.mutateAsync({ id: match.id, body: {
        scheduled_at: when ? `${when}:00` : undefined,
        venue_id: venue,
        overs_limit: Math.min(50, Math.max(1, Number(overs) || match.overs_limit)),
      } });
      onDone();
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <View style={{ marginTop: 10, borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 12 }}>
      <Text style={{ color: t.primary, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Edit match (teams can't be changed)</Text>
      <Field label="Overs" value={overs} onChangeText={setOvers} keyboardType="numeric" />
      {!!venues.length && (
        <>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Venue</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
            {venues.map((v) => <Chip key={v.id} label={v.name} selected={venue === v.id} onPress={() => setVenue(venue === v.id ? null : v.id)} />)}
          </View>
        </>
      )}
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Date & time</Text>
      <DateTimePicker value={when} onChange={setWhen} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1 }}><Btn label={update.isPending ? "Saving…" : "Save changes"} onPress={save} loading={update.isPending} /></View>
        <Btn label="Cancel" tone="ghost" onPress={onDone} />
      </View>
      {msg && <Note tone="error">{msg}</Note>}
    </View>
  );
}

function VenueManager() {
  const t = useTheme();
  const { data: venues } = useVenues();
  const create = useCreateVenue();
  const del = useDeleteVenue();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  return (
    <Card>
      <Muted>Venues</Muted>
      <Field label="Venue name" value={name} onChangeText={setName} />
      <Field label="City" value={city} onChangeText={setCity} />
      <Btn label={create.isPending ? "Adding…" : "Add venue"} onPress={async () => { if (name.trim() && city.trim()) { await create.mutateAsync({ name: name.trim(), city: city.trim() }); setName(""); setCity(""); } }} loading={create.isPending} />
      <View style={{ marginTop: 8 }}>
        {(venues ?? []).map((v) => (
          <View key={v.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Text style={{ color: t.text }}>{v.name} <Text style={{ color: t.muted, fontSize: 12 }}>{v.city}</Text></Text>
            <Text style={{ color: "#ef4444" }} onPress={() => del.mutate(v.id)}>Delete</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
