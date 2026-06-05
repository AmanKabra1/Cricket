import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStandings, useTeams, useTournaments, useVenues } from "@/api/hooks";
import { useApproveTournament, useCreateMatch, useCreateTournament, useDeleteTournament, useGenerateFixtures, useUpdateTournament } from "@/api/admin";
import { useAppSelector } from "@/store";
import DateTimePicker from "@/components/DateTimePicker";
import type { Tournament } from "@/types";

// Close an open popover/form when the user clicks or taps anywhere outside it.
function useClickOutside(active: boolean, onClose: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [active]);
  return ref;
}

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
      <div className="min-w-0"><CreateTournamentForm /></div>
      <div className="min-w-0"><TournamentList /></div>
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
  // Management view: own (admin) / all (super). Same load/refresh UX as Matches.
  const { data: tournaments, isLoading, isError, refetch, isFetching } = useTournaments(true);
  const user = useAppSelector((s) => s.auth.user);
  const approve = useApproveTournament();
  const del = useDeleteTournament();
  const rename = useUpdateTournament();
  const isSuper = user?.role === "SUPER_ADMIN";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Tournaments</h2>
        <button className="btn-ghost text-xs" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>
      <div className="space-y-2">
        {isLoading && <p className="muted">Loading tournaments…</p>}
        {isError && (
          <p className="text-sm text-red-500">
            Couldn’t load tournaments (server may be waking up). Tap Refresh in a moment.
          </p>
        )}
        {(tournaments ?? []).map((t) => (
          <div key={t.id} className="card-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/tournaments/${t.id}`} className="font-medium hover:text-pitch-600">{t.name}</Link>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs muted">{t.format.replace("_", " ")} · {t.status}</span>
                <button
                  className="rounded px-2 py-1 text-xs font-semibold text-pitch-600 hover:bg-pitch-500/10"
                  title="Rename tournament"
                  onClick={() => {
                    const name = window.prompt("Tournament name", t.name)?.trim();
                    if (name && name !== t.name) rename.mutate({ id: t.id, name });
                  }}
                >
                  Edit
                </button>
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
        {!isLoading && !isError && !tournaments?.length && <p className="muted">No tournaments yet.</p>}
      </div>
    </div>
  );
}

// Gap between matches on the SAME day (used when a start time is given).
const INTERVALS = [
  { label: "2 hours apart", minutes: 120 },
  { label: "3 hours apart", minutes: 180 },
  { label: "4 hours apart", minutes: 240 },
  { label: "6 hours apart", minutes: 360 },
];

function FixturesPanel({ tournament }: { tournament: Tournament }) {
  const gen = useGenerateFixtures(tournament.id);
  const { data: venues } = useVenues();
  const [open, setOpen] = useState(false);
  const { data: standings } = useStandings(tournament.id, open); // team list, when open
  const [overs, setOvers] = useState(20);
  const [venueId, setVenueId] = useState<number | "">("");
  const [startAt, setStartAt] = useState("");
  const [interval, setInterval] = useState(180);
  const [perDay, setPerDay] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  const formRef = useClickOutside(open, () => setOpen(false)); // click away to close

  // How many matches this format will create, and how many days they span.
  const nTeams = standings?.length ?? 0;
  const isKnockout = tournament.format === "KNOCKOUT";
  const nMatches = nTeams < 2 ? 0 : isKnockout ? Math.floor(nTeams / 2) : (nTeams * (nTeams - 1)) / 2;
  const nDays = startAt && perDay > 0 ? Math.ceil(nMatches / perDay) : 0;
  const oddKnockout = isKnockout && nTeams % 2 === 1;

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await gen.mutateAsync({
        overs_limit: overs,
        venue_id: venueId === "" ? null : Number(venueId),
        start_at: startAt ? (startAt.length === 16 ? `${startAt}:00` : startAt) : null,
        interval_minutes: interval,
        matches_per_day: perDay,
      });
      setMsg("Fixtures generated ✓");
      setOpen(false);
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to generate");
    }
  };

  // Auto-generate lays out the whole schedule once — offered only while the
  // tournament has no fixtures yet. Once any exist (auto or manual), it's hidden
  // for everyone (admin and super admin); you can still add more manually.
  const hasFixtures = (tournament.match_count ?? 0) > 0;

  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        {hasFixtures ? (
          <span className="text-xs muted">{tournament.match_count} fixture{tournament.match_count === 1 ? "" : "s"} created</span>
        ) : (
          <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>Auto-generate fixtures…</button>
        )}
        <ManualMatchForm tournament={tournament} />
        {msg && <span className="text-xs muted">{msg}</span>}
      </span>
    );
  }

  return (
    <form ref={formRef} onSubmit={run} className="mt-1 w-full space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold text-pitch-600">Auto-generate (whole schedule at once)</p>
      <p className="text-xs muted">Applied to every fixture. With a start time, matches fill each day then continue the next — so a long tournament spans days, not one overnight run.</p>
      {/* Lock all inputs while generating so values can't change mid-request. */}
      <fieldset disabled={gen.isPending} className="m-0 space-y-2 border-0 p-0">
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
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold muted">Matches per day</span>
            <input className="input" type="number" min={1} max={20} value={perDay}
              onChange={(e) => setPerDay(Math.max(1, Number(e.target.value)))} />
          </label>
          {/* Gap only applies when more than one match shares a day. */}
          {perDay > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold muted">Gap between them</span>
              <select className="input" value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
                {INTERVALS.map((i) => <option key={i.minutes} value={i.minutes}>{i.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      </fieldset>
      {/* Edge-case-aware preview of what will be created. */}
      {nMatches > 0 && (
        <p className="rounded-lg bg-pitch-500/10 p-2 text-xs text-pitch-700 dark:text-pitch-300">
          {isKnockout ? (
            <>{nTeams} teams → <b>{nMatches}</b> first-round match{nMatches === 1 ? "" : "es"} (winners advance).</>
          ) : (
            <>{nTeams} teams, each plays every other once → <b>{nMatches}</b> match{nMatches === 1 ? "" : "es"}.</>
          )}
          {startAt && nDays > 0 && <> Scheduled {perDay}/day, so it runs over <b>{nDays}</b> day{nDays === 1 ? "" : "s"}.</>}
        </p>
      )}
      {oddKnockout && (
        <p className="text-xs text-amber-600">Odd number of teams — one team sits out the first round.</p>
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

// Lets the admin add tournament matches one at a time on their own schedule:
// pick the two teams, exact date & time, venue and overs for each.
function ManualMatchForm({ tournament }: { tournament: Tournament }) {
  const [open, setOpen] = useState(false);
  // Only fetch the team list once the form is actually opened.
  const { data: standings } = useStandings(tournament.id, open);
  const { data: venues } = useVenues();
  const create = useCreateMatch();
  const [a, setA] = useState<number | "">("");
  const [b, setB] = useState<number | "">("");
  const [overs, setOvers] = useState(20);
  const [venueId, setVenueId] = useState<number | "">("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const formRef = useClickOutside(open, () => setOpen(false)); // click away to close

  const teamsList = standings ?? [];

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (a === "" || b === "" || a === b) {
      setMsg("Pick two different teams.");
      return;
    }
    try {
      await create.mutateAsync({
        team_a_id: Number(a),
        team_b_id: Number(b),
        tournament_id: tournament.id,
        venue_id: venueId === "" ? undefined : Number(venueId),
        overs_limit: overs,
        scheduled_at: when ? (when.length === 16 ? `${when}:00` : when) : undefined,
      });
      setMsg("Match added ✓");
      setA(""); setB(""); setWhen("");
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to add match");
    }
  };

  if (!open) {
    return <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>Add match manually…</button>;
  }

  return (
    <form ref={formRef} onSubmit={add} className="mt-1 w-full space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold text-pitch-600">Add one match (your own schedule)</p>
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={a} onChange={(e) => setA(Number(e.target.value))} required>
          <option value="">Team A *</option>
          {teamsList.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
        </select>
        <select className="input" value={b} onChange={(e) => setB(Number(e.target.value))} required>
          <option value="">Team B *</option>
          {teamsList.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
        </select>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Overs</span>
          <input className="input" type="number" min={1} max={100} value={overs} onChange={(e) => setOvers(Number(e.target.value))} />
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
        <span className="mb-1 block text-xs font-semibold muted">Date &amp; time</span>
        <DateTimePicker value={when} onChange={setWhen} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-sm" disabled={create.isPending}>
          {create.isPending ? "Adding…" : "Add match"}
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(false)}>Done</button>
      </div>
      {msg && <p className="text-xs muted">{msg}</p>}
    </form>
  );
}
