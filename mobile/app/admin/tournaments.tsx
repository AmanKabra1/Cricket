import { useState } from "react";
import { Text, View } from "react-native";
import { useTeams } from "@/api/hooks";
import { useMe } from "@/api/auth";
import {
  errorDetail, useApproveTournament, useCreateMatch, useCreateTournament, useDeleteTournament,
  useGenerateFixtures, useStandings, useTournamentsAdmin, useUpdateTournament, useVenues,
} from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Chip, Note, Muted } from "@/components/ui";
import DateTimePicker from "@/components/DateTimePicker";
import { useTheme } from "@/theme";
import type { Tournament } from "@/types";

// What each format does, shown so the organiser knows which matches get created.
const FORMAT_INFO: Record<string, { label: string; desc: string; evenTeams?: boolean }> = {
  LEAGUE: { label: "League (round-robin)", desc: "Every team plays every other once. Ranked by points (win 2, tie/no-result 1), then net run rate." },
  ROUND_ROBIN: { label: "Round robin", desc: "Same as league — everyone plays everyone once and the points table decides the winner." },
  GROUP_STAGE: { label: "Group stage", desc: "Single round-robin among the selected teams (one group); the top of the table advances." },
  KNOCKOUT: { label: "Knockout (bracket)", desc: "Single elimination. Round one pairs teams (1v2, 3v4, …) and winners advance. Use an even number of teams.", evenTeams: true },
};
const FORMATS = Object.keys(FORMAT_INFO);

const INTERVALS = [
  { label: "2h apart", min: 120 },
  { label: "3h apart", min: 180 },
  { label: "4h apart", min: 240 },
  { label: "6h apart", min: 360 },
];

export default function ManageTournaments() {
  const { data: tournaments, isLoading, refetch, isFetching } = useTournamentsAdmin();
  const { data: me } = useMe();
  const isSuper = me?.role === "SUPER_ADMIN";

  return (
    <Screen onRefresh={refetch} refreshing={isFetching}>
      <H1>Tournaments</H1>
      <CreateTournamentForm />

      {isLoading && <Note>Loading…</Note>}
      {(tournaments ?? []).map((tn: Tournament) => (
        <TournamentRow key={tn.id} tn={tn} isSuper={isSuper} />
      ))}
      {!isLoading && !tournaments?.length && <Note>No tournaments yet.</Note>}
    </Screen>
  );
}

function CreateTournamentForm() {
  const t = useTheme();
  const { data: teams } = useTeams();
  const create = useCreateTournament();
  const [name, setName] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [picked, setPicked] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    setMsg(null);
    if (!name.trim() || picked.length < 2) { setMsg("Name + at least 2 teams."); return; }
    try {
      await create.mutateAsync({ name: name.trim(), format, team_ids: picked });
      setMsg("Created ✓ — a super admin must approve before fixtures.");
      setName(""); setPicked([]);
    } catch (e) { setMsg(errorDetail(e)); }
  };

  const oddKnockout = FORMAT_INFO[format].evenTeams && picked.length % 2 === 1;

  return (
    <Card>
      <Muted>Create tournament</Muted>
      <Field label="Name *" value={name} onChangeText={setName} />
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Format</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
        {FORMATS.map((f) => <Chip key={f} label={FORMAT_INFO[f].label} selected={format === f} onPress={() => setFormat(f)} />)}
      </View>
      <Text style={{ color: t.primary, fontSize: 12, backgroundColor: t.primary + "18", padding: 8, borderRadius: 8 }}>{FORMAT_INFO[format].desc}</Text>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginTop: 8 }}>Teams ({picked.length})</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
        {(teams ?? []).map((tm) => <Chip key={tm.id} label={tm.name} selected={picked.includes(tm.id)} onPress={() => toggle(tm.id)} />)}
      </View>
      {oddKnockout && <Note tone="error">Knockout works best with an even number of teams — one would be left unpaired.</Note>}
      <Btn label={create.isPending ? "Creating…" : "Create tournament"} onPress={submit} loading={create.isPending} />
      {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
    </Card>
  );
}

function TournamentRow({ tn, isSuper }: { tn: Tournament; isSuper: boolean }) {
  const t = useTheme();
  const approve = useApproveTournament();
  const del = useDeleteTournament();
  const rename = useUpdateTournament();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tn.name);

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: t.text, fontWeight: "700", flex: 1 }}>{tn.name}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{tn.format.replace("_", " ")} · {tn.status}</Text>
      </View>
      {editing && (
        <View style={{ marginTop: 8 }}>
          <Field label="Tournament name" value={name} onChangeText={setName} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Btn label={rename.isPending ? "Saving…" : "Save name"} loading={rename.isPending}
                onPress={async () => { if (name.trim()) { await rename.mutateAsync({ id: tn.id, name: name.trim() }); setEditing(false); } }} />
            </View>
            <Btn label="Cancel" tone="ghost" onPress={() => { setName(tn.name); setEditing(false); }} />
          </View>
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        <Chip label="Edit" selected={false} onPress={() => setEditing((e) => !e)} />
        {isSuper && tn.status === "PENDING" && (
          <Chip label="Approve" selected={false} loading={approve.isPending && approve.variables === tn.id} onPress={() => approve.mutate(tn.id)} />
        )}
        {isSuper && <Chip label="Delete" selected={false} loading={del.isPending && del.variables === tn.id} onPress={() => del.mutate(tn.id)} />}
      </View>
      {tn.status === "APPROVED" || tn.status === "ONGOING" ? (
        <FixturesPanel tournament={tn} />
      ) : tn.status === "PENDING" ? (
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>Awaiting super-admin approval before fixtures.</Text>
      ) : (
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>{tn.status.toLowerCase()} — fixtures unavailable.</Text>
      )}
    </Card>
  );
}

function FixturesPanel({ tournament }: { tournament: Tournament }) {
  const t = useTheme();
  const gen = useGenerateFixtures(tournament.id);
  const { data: venues } = useVenues();
  const [open, setOpen] = useState(false);
  const { data: standings } = useStandings(tournament.id, open);
  const [overs, setOvers] = useState("20");
  const [venue, setVenue] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [perDay, setPerDay] = useState("2");
  const [interval, setInterval] = useState(180);
  const [msg, setMsg] = useState<string | null>(null);

  const hasFixtures = ((tournament as any).match_count ?? 0) > 0;
  const nTeams = standings?.length ?? 0;
  const isKnockout = tournament.format === "KNOCKOUT";
  const nMatches = nTeams < 2 ? 0 : isKnockout ? Math.floor(nTeams / 2) : (nTeams * (nTeams - 1)) / 2;
  const pd = Math.max(1, Number(perDay) || 1);
  const nDays = start && pd > 0 ? Math.ceil(nMatches / pd) : 0;
  const oddKnockout = isKnockout && nTeams % 2 === 1;

  const run = async () => {
    setMsg(null);
    try {
      await gen.mutateAsync({
        overs_limit: Math.max(1, Number(overs) || 20),
        matches_per_day: pd,
        interval_minutes: interval,
        venue_id: venue,
        start_at: start ? `${start}:00` : null,
      });
      setMsg("Fixtures generated ✓");
      setOpen(false);
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      {/* Auto-generate is offered only until fixtures exist; manual is always available. */}
      {hasFixtures ? (
        <Text style={{ color: t.muted, fontSize: 12 }}>{(tournament as any).match_count} fixture{(tournament as any).match_count === 1 ? "" : "s"} created</Text>
      ) : !open ? (
        <Chip label="Auto-generate fixtures…" selected={false} onPress={() => setOpen(true)} />
      ) : (
        <View style={{ borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <Text style={{ color: t.primary, fontWeight: "700", fontSize: 12, marginBottom: 2 }}>Auto-generate (whole schedule at once)</Text>
          <Text style={{ color: t.muted, fontSize: 12, marginBottom: 8 }}>With a start time, matches fill each day then continue the next — a long tournament spans days.</Text>
          {/* Lock the inputs while generating so the values can't change mid-request. */}
          <View pointerEvents={gen.isPending ? "none" : "auto"} style={{ opacity: gen.isPending ? 0.5 : 1 }}>
          <Field label="Overs / match" value={overs} onChangeText={setOvers} keyboardType="numeric" />
          {!!venues?.length && (
            <>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Venue (optional)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
                {venues.map((v) => <Chip key={v.id} label={v.name} selected={venue === v.id} onPress={() => setVenue(venue === v.id ? null : v.id)} />)}
              </View>
            </>
          )}
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>First match date & time (optional)</Text>
          <DateTimePicker value={start} onChange={setStart} />
          {!!start && (
            <>
              <View style={{ marginTop: 8 }}>
                <Field label="Matches per day" value={perDay} onChangeText={setPerDay} keyboardType="numeric" />
              </View>
              {pd > 1 && (
                <>
                  <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Gap between same-day matches</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
                    {INTERVALS.map((g) => <Chip key={g.min} label={g.label} selected={interval === g.min} onPress={() => setInterval(g.min)} />)}
                  </View>
                </>
              )}
            </>
          )}
          {nMatches > 0 && (
            <Text style={{ color: t.primary, fontSize: 12, backgroundColor: t.primary + "18", padding: 8, borderRadius: 8, marginTop: 4 }}>
              {isKnockout
                ? `${nTeams} teams → ${nMatches} first-round match${nMatches === 1 ? "" : "es"} (winners advance).`
                : `${nTeams} teams, each plays every other once → ${nMatches} match${nMatches === 1 ? "" : "es"}.`}
              {start && nDays > 0 ? ` Scheduled ${pd}/day, so it runs over ${nDays} day${nDays === 1 ? "" : "s"}.` : ""}
            </Text>
          )}
          {oddKnockout && <Note tone="error">Odd number of teams — one team sits out the first round.</Note>}
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Btn label={gen.isPending ? "Generating…" : "Generate"} onPress={run} loading={gen.isPending} /></View>
            <Btn label="Cancel" tone="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      )}

      <View style={{ marginTop: 8 }}>
        <ManualMatchForm tournament={tournament} />
      </View>
      {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
    </View>
  );
}

// Add tournament matches one at a time: pick the two teams, date & time, venue, overs.
function ManualMatchForm({ tournament }: { tournament: Tournament }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const { data: standings } = useStandings(tournament.id, open);
  const { data: venues } = useVenues();
  const create = useCreateMatch();
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [overs, setOvers] = useState("20");
  const [venue, setVenue] = useState<number | null>(null);
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const teamsList = standings ?? [];

  const add = async () => {
    setMsg(null);
    if (!a || !b || a === b) { setMsg("Pick two different teams."); return; }
    try {
      await create.mutateAsync({
        team_a_id: a,
        team_b_id: b,
        tournament_id: tournament.id,
        venue_id: venue ?? undefined,
        overs_limit: Math.max(1, Number(overs) || 20),
        scheduled_at: when ? `${when}:00` : undefined,
      });
      setMsg("Match added ✓");
      setA(null); setB(null); setWhen("");
    } catch (e) { setMsg(errorDetail(e)); }
  };

  if (!open) return <Chip label="Add match manually…" selected={false} onPress={() => setOpen(true)} />;

  return (
    <View style={{ borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 12 }}>
      <Text style={{ color: t.primary, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>Add one match (your own schedule)</Text>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Team A</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        {teamsList.map((tm) => <Chip key={tm.team_id} label={tm.team_name} selected={a === tm.team_id} onPress={() => setA(tm.team_id)} />)}
      </View>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Team B</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
        {teamsList.map((tm) => <Chip key={tm.team_id} label={tm.team_name} selected={b === tm.team_id} onPress={() => setB(tm.team_id)} />)}
      </View>
      <Field label="Overs" value={overs} onChangeText={setOvers} keyboardType="numeric" />
      {!!venues?.length && (
        <>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Venue (optional)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
            {venues.map((v) => <Chip key={v.id} label={v.name} selected={venue === v.id} onPress={() => setVenue(venue === v.id ? null : v.id)} />)}
          </View>
        </>
      )}
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>Date & time</Text>
      <DateTimePicker value={when} onChange={setWhen} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <View style={{ flex: 1 }}><Btn label={create.isPending ? "Adding…" : "Add match"} onPress={add} loading={create.isPending} /></View>
        <Btn label="Done" tone="ghost" onPress={() => setOpen(false)} />
      </View>
      {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
    </View>
  );
}
