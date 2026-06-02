import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTeams, useTournaments, useVenues } from "@/api/hooks";
import { useApproveTournament, useCreateTournament, useDeleteTournament, useGenerateFixtures } from "@/api/admin";
import { useAppSelector } from "@/store";
import DateTimePicker from "@/components/DateTimePicker";
import type { Tournament } from "@/types";

// What each format does when you "Generate fixtures", shown in the form so the
// organiser knows exactly which matches will be created.
const FORMAT_INFO: Record<string, { label: string; desc: string; evenTeams?: boolean }> = {
  LEAGUE: {
    label: "League (round-robin)",
    desc: "Every team plays every other team once. Ranked by points (win 2, tie/no-result 1), then net run rate. Best for a season table.",
  },
  ROUND_ROBIN: {
    label: "Round robin",
    desc: "Same as league — everyone plays everyone once and the points table decides the winner.",
  },
  GROUP_STAGE: {
    label: "Group stage",
    desc: "Single round-robin among the selected teams (treated as one group); the top of the table advances.",
  },
  KNOCKOUT: {
    label: "Knockout (bracket)",
    desc: "Single elimination. The first round pairs teams (1v2, 3v4, …) and winners advance. Use an even number of teams.",
    evenTeams: true,
  },
};
const FORMATS = Object.keys(FORMAT_INFO);

export default function ManageTournaments() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CreateTournamentForm />
      <TournamentList />
    </div>
  );
}

function CreateTournamentForm() {
  const { data: teams } = useTeams();
  const create = useCreateTournament();
  const [name, setName] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ name, format, team_ids: [...picked] });
    setName(""); setPicked(new Set());
  };

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-4">
      <h2 className="text-lg font-bold">Create tournament</h2>
      <input className="input" placeholder="Tournament name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
        {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_INFO[f].label}</option>)}
      </select>
      {/* Format-specific explanation of what fixtures will be generated. */}
      <p className="rounded-lg bg-pitch-500/10 p-2 text-xs text-pitch-700 dark:text-pitch-300">
        {FORMAT_INFO[format].desc}
      </p>
      <div>
        <span className="mb-1 block text-xs font-semibold muted">Teams ({picked.size} selected)</span>
        <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
          {(teams ?? []).map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded p-1 text-sm">
              <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      </div>
      {/* Knockout pairs teams two-by-two, so an odd count leaves one without a match. */}
      {FORMAT_INFO[format].evenTeams && picked.size % 2 === 1 && (
        <p className="text-xs text-amber-600">Knockout works best with an even number of teams — one team would be left unpaired.</p>
      )}
      <button className="btn-primary w-full" disabled={create.isPending || picked.size < 2}>
        {create.isPending ? "Creating…" : "Create tournament"}
      </button>
      <p className="text-xs muted">Pick at least 2 teams, create the tournament, then "Generate fixtures" to schedule the matches.</p>
    </form>
  );
}

function TournamentList() {
  const { data: tournaments } = useTournaments();
  const user = useAppSelector((s) => s.auth.user);
  const approve = useApproveTournament();
  const del = useDeleteTournament();
  const isSuper = user?.role === "SUPER_ADMIN";

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Tournaments</h2>
      <div className="space-y-2">
        {(tournaments ?? []).map((t) => (
          <div key={t.id} className="card-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/tournaments/${t.id}`} className="font-medium hover:text-pitch-600">{t.name}</Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs muted">{t.format.replace("_", " ")} · {t.status}</span>
                {isSuper && (
                  <button
                    className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                    title="Delete tournament + its matches"
                    disabled={del.isPending && del.variables === t.id}
                    onClick={() => {
                      if (confirm(`Delete "${t.name}"? This removes its fixtures and all their match data.`)) {
                        del.mutate(t.id);
                      }
                    }}
                  >
                    {del.isPending && del.variables === t.id ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {user?.role === "SUPER_ADMIN" && t.status === "PENDING" && (
                <button className="btn-ghost text-xs disabled:opacity-50" disabled={approve.isPending && approve.variables === t.id} onClick={() => approve.mutate(t.id)}>
                  {approve.isPending && approve.variables === t.id ? "Approving…" : "Approve"}
                </button>
              )}
              {/* Fixtures can only be generated after a super admin approves —
                  applies to match admins AND super admins alike. */}
              {t.status === "APPROVED" || t.status === "ONGOING" ? (
                <FixturesPanel tournament={t} />
              ) : t.status === "PENDING" ? (
                <span className="text-xs muted">Awaiting super-admin approval before fixtures.</span>
              ) : (
                <span className="text-xs muted">{t.status.toLowerCase()} — fixtures unavailable.</span>
              )}
            </div>
          </div>
        ))}
        {!tournaments?.length && <p className="muted">No tournaments yet.</p>}
      </div>
    </div>
  );
}

// Time-gap presets between matches (used when a start time is given).
const INTERVALS = [
  { label: "3 hours apart", minutes: 180 },
  { label: "6 hours apart", minutes: 360 },
  { label: "1 day apart", minutes: 1440 },
  { label: "2 days apart", minutes: 2880 },
  { label: "1 week apart", minutes: 10080 },
];

function FixturesPanel({ tournament }: { tournament: Tournament }) {
  const gen = useGenerateFixtures(tournament.id);
  const { data: venues } = useVenues();
  const [open, setOpen] = useState(false);
  const [overs, setOvers] = useState(20);
  const [venueId, setVenueId] = useState<number | "">("");
  const [startAt, setStartAt] = useState("");
  const [interval, setInterval] = useState(180);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await gen.mutateAsync({
        overs_limit: overs,
        venue_id: venueId === "" ? null : Number(venueId),
        start_at: startAt ? (startAt.length === 16 ? `${startAt}:00` : startAt) : null,
        interval_minutes: interval,
      });
      setMsg("Fixtures generated ✓");
      setOpen(false);
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to generate");
    }
  };

  if (!open) {
    return (
      <span className="flex items-center gap-2">
        <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>Generate fixtures…</button>
        {msg && <span className="text-xs muted">{msg}</span>}
      </span>
    );
  }

  return (
    <form onSubmit={run} className="mt-1 w-full space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs muted">These apply to every fixture. Matches are spaced out from the start time.</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Overs / match</span>
          <input className="input" type="number" min={1} max={100} value={overs}
            onChange={(e) => setOvers(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Venue</span>
          <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">— none —</option>
            {(venues ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold muted">First match date &amp; time (optional)</span>
        <DateTimePicker value={startAt} onChange={setStartAt} />
      </label>
      {startAt && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Spacing between matches</span>
          <select className="input" value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
            {INTERVALS.map((i) => <option key={i.minutes} value={i.minutes}>{i.label}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-sm" disabled={gen.isPending}>
          {gen.isPending ? "Generating…" : "Generate"}
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {msg && <p className="text-xs text-red-500">{msg}</p>}
    </form>
  );
}
