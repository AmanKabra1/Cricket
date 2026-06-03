import { useState } from "react";
import { Text, View } from "react-native";
import { useTeams } from "@/api/hooks";
import { useMe } from "@/api/auth";
import {
  errorDetail, useApproveTournament, useCreateTournament, useDeleteTournament,
  useGenerateFixtures, useTournamentsAdmin, useVenues,
} from "@/api/admin";
import { Screen, H1, Card, Btn, Field, Chip, Note, Muted } from "@/components/ui";
import { useTheme } from "@/theme";
import type { Tournament } from "@/types";

const FORMATS = ["LEAGUE", "ROUND_ROBIN", "GROUP_STAGE", "KNOCKOUT"];

export default function ManageTournaments() {
  const t = useTheme();
  const { data: teams } = useTeams();
  const { data: tournaments, isLoading } = useTournamentsAdmin();
  const { data: me } = useMe();
  const create = useCreateTournament();
  const approve = useApproveTournament();
  const del = useDeleteTournament();
  const isSuper = me?.role === "SUPER_ADMIN";

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

  return (
    <Screen>
      <H1>Tournaments</H1>
      <Card>
        <Muted>Create tournament</Muted>
        <Field label="Name" value={name} onChangeText={setName} />
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Format</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
          {FORMATS.map((f) => <Chip key={f} label={f.replace("_", " ")} selected={format === f} onPress={() => setFormat(f)} />)}
        </View>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Teams ({picked.length})</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
          {(teams ?? []).map((tm) => <Chip key={tm.id} label={tm.name} selected={picked.includes(tm.id)} onPress={() => toggle(tm.id)} />)}
        </View>
        <Btn label={create.isPending ? "Creating…" : "Create tournament"} onPress={submit} disabled={create.isPending} />
        {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
      </Card>

      {isLoading && <Note>Loading…</Note>}
      {(tournaments ?? []).map((tn: Tournament) => (
        <Card key={tn.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: t.text, fontWeight: "700" }}>{tn.name}</Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>{tn.format.replace("_", " ")} · {tn.status}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {isSuper && tn.status === "PENDING" && <Chip label="Approve" selected={false} onPress={() => approve.mutate(tn.id)} />}
            {isSuper && <Chip label="Delete" selected={false} onPress={() => del.mutate(tn.id)} />}
          </View>
          {(tn.status === "APPROVED" || tn.status === "ONGOING") ? (
            <GenerateFixtures tournament={tn} />
          ) : tn.status === "PENDING" ? (
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>Awaiting approval before fixtures.</Text>
          ) : null}
        </Card>
      ))}
      {!isLoading && !tournaments?.length && <Note>No tournaments yet.</Note>}
    </Screen>
  );
}

const GAPS = [
  { label: "2h apart", min: 120 },
  { label: "3h apart", min: 180 },
  { label: "1 day apart", min: 1440 },
];

function GenerateFixtures({ tournament }: { tournament: Tournament }) {
  const t = useTheme();
  const gen = useGenerateFixtures(tournament.id);
  const { data: venues } = useVenues();
  const [open, setOpen] = useState(false);
  const [overs, setOvers] = useState("20");
  const [perDay, setPerDay] = useState("2");
  const [gap, setGap] = useState(180);
  const [venue, setVenue] = useState<number | null>(null);
  const [start, setStart] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const hasFixtures = ((tournament as any).match_count ?? 0) > 0;

  if (hasFixtures) return <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>{(tournament as any).match_count} fixtures created.</Text>;
  if (!open) return <View style={{ marginTop: 6 }}><Chip label="Generate fixtures…" selected={false} onPress={() => setOpen(true)} /></View>;

  const run = async () => {
    setMsg(null);
    try {
      await gen.mutateAsync({
        overs_limit: Math.max(1, Number(overs) || 20),
        matches_per_day: Math.max(1, Number(perDay) || 2),
        interval_minutes: gap,
        venue_id: venue,
        start_at: start ? (start.length === 16 ? `${start}:00` : start) : null,
      });
      setMsg("Fixtures generated ✓");
      setOpen(false);
    } catch (e) { setMsg(errorDetail(e)); }
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Field label="Overs / match" value={overs} onChangeText={setOvers} keyboardType="numeric" />
      {!!venues?.length && (
        <>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Venue (optional)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
            {venues.map((v) => <Chip key={v.id} label={v.name} selected={venue === v.id} onPress={() => setVenue(venue === v.id ? null : v.id)} />)}
          </View>
        </>
      )}
      <Field label="First match date & time (optional, YYYY-MM-DDTHH:MM)" value={start} onChangeText={setStart} />
      <Field label="Matches per day" value={perDay} onChangeText={setPerDay} keyboardType="numeric" />
      {Number(perDay) > 1 && (
        <>
          <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>Gap between same-day matches</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginVertical: 6 }}>
            {GAPS.map((g) => <Chip key={g.min} label={g.label} selected={gap === g.min} onPress={() => setGap(g.min)} />)}
          </View>
        </>
      )}
      <Btn label={gen.isPending ? "Generating…" : "Generate"} onPress={run} disabled={gen.isPending} />
      {msg && <Note tone={msg.includes("✓") ? "ok" : "error"}>{msg}</Note>}
    </View>
  );
}
