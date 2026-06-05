import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMatches, useTeams, useVenues, useTournaments } from "@/api/hooks";
import { useApproveMatch, useCreateMatch, useCreateVenue, useDeleteMatch, useDeleteVenue, useUpdateMatch, useUsers } from "@/api/admin";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useAppSelector } from "@/store";
import DateTimePicker from "@/components/DateTimePicker";

export default function ManageMatches() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* min-w-0 lets these grid columns shrink on mobile instead of overflowing. */}
      <div className="min-w-0 space-y-6">
        <CreateMatchForm />
        <CreateVenueForm />
        <VenueList />
      </div>
      <div className="min-w-0">
        <MatchList />
      </div>
    </div>
  );
}

function VenueList() {
  const { data: venues } = useVenues();
  const del = useDeleteVenue();
  if (!venues?.length) return null;
  return (
    <div className="card-surface p-4">
      <h2 className="mb-2 text-lg font-bold">Venues</h2>
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {venues.map((v) => (
          <div key={v.id} className="flex items-center justify-between py-2">
            <span>
              <span className="font-medium">{v.name}</span>
              <span className="ml-2 text-xs muted">{v.city}</span>
            </span>
            <button
              className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
              disabled={del.isPending && del.variables === v.id}
              onClick={() => {
                if (confirm(`Delete venue "${v.name}"?`)) del.mutate(v.id);
              }}
            >
              {del.isPending && del.variables === v.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateMatchForm() {
  const { data: teams } = useTeams();
  const { data: venues } = useVenues();
  const { data: tournaments } = useTournaments();
  const create = useCreateMatch();
  const isSuper = useAppSelector((s) => s.auth.user?.role === "SUPER_ADMIN");

  const [a, setA] = useState<number | "">("");
  const [b, setB] = useState<number | "">("");
  const [venue, setVenue] = useState<number | "">("");
  const [tournament, setTournament] = useState<number | "">("");
  const [overs, setOvers] = useState(20);
  const [when, setWhen] = useState("");
  const [adminIds, setAdminIds] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setCreatedId(null);
    if (a === "" || b === "" || a === b) {
      setMsg("Pick two different teams.");
      return;
    }
    if (!when) {
      setMsg("Pick a date & time for the match.");
      return;
    }
    try {
      const match = await create.mutateAsync({
        team_a_id: Number(a),
        team_b_id: Number(b),
        venue_id: venue === "" ? undefined : Number(venue),
        tournament_id: tournament === "" ? undefined : Number(tournament),
        overs_limit: overs,
        // Send the picked wall-clock time as-is (no UTC conversion) so it shows
        // back exactly as chosen, in local/IST time. Add seconds for ISO format.
        scheduled_at: when.length === 16 ? `${when}:00` : when,
        admin_ids: adminIds,
      });
      setCreatedId(match.id);
      setA(""); setB(""); setWhen(""); setAdminIds([]);
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Couldn't create the match (server may be waking — try again).");
    }
  };

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-4">
      <h2 className="text-lg font-bold">Create match</h2>
      <div className="grid grid-cols-2 gap-3">
        <select className="input" value={a} onChange={(e) => setA(Number(e.target.value))} required>
          <option value="">Team A *</option>
          {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input" value={b} onChange={(e) => setB(Number(e.target.value))} required>
          <option value="">Team B *</option>
          {(teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select className="input" value={venue} onChange={(e) => setVenue(Number(e.target.value))}>
          <option value="">Venue (optional)</option>
          {(venues ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input className="input" type="number" min={1} max={100} value={overs}
          onChange={(e) => setOvers(Number(e.target.value))} placeholder="Overs" />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold muted">Date &amp; time *</span>
        <DateTimePicker value={when} onChange={setWhen} required />
      </label>
      <select className="input" value={tournament} onChange={(e) => setTournament(Number(e.target.value))}>
        <option value="">Tournament (optional)</option>
        {(tournaments ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {/* Super admins can grant scoring access to specific admins (optional). */}
      {isSuper && <AdminPicker selected={adminIds} onChange={setAdminIds} />}

      {msg && <p className="text-sm text-red-500">{msg}</p>}
      {createdId && (
        <div className="rounded-lg border border-pitch-500/40 bg-pitch-500/10 p-3 text-sm">
          ✓ Match created (Upcoming) — it’s in the list on the right.
          <Link to={`/admin/matches/${createdId}/score`} className="ml-1 font-semibold text-pitch-600 underline">
            Score it now →
          </Link>
        </div>
      )}
      <button className="btn-primary w-full" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create match"}
      </button>
    </form>
  );
}

function AdminPicker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { data: users } = useUsers();
  // Only match admins are assignable — super admins can already score any match,
  // so there's no point listing them here.
  const admins = (users ?? []).filter((u) => u.role === "MATCH_ADMIN" && u.is_active);
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  if (!admins.length) return null;
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold muted">
        Assign match admins to score (optional — super admins can always score)
      </span>
      <div className="flex flex-wrap gap-2">
        {admins.map((u) => (
          <button
            type="button"
            key={u.id}
            onClick={() => toggle(u.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              selected.includes(u.id) ? "border-pitch-500 bg-pitch-500 text-white" : ""
            }`}
            style={{ borderColor: selected.includes(u.id) ? undefined : "var(--border)" }}
          >
            {u.full_name}
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateVenueForm() {
  const create = useCreateVenue();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ name, city });
    setName(""); setCity("");
  };
  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-4">
      <h2 className="text-lg font-bold">Add venue</h2>
      <input className="input" placeholder="Venue name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="input" placeholder="City *" value={city} onChange={(e) => setCity(e.target.value)} required />
      <button className="btn-primary w-full" disabled={create.isPending}>{create.isPending ? "Adding…" : "Add venue"}</button>
    </form>
  );
}

function MatchList() {
  const { data: matches, isLoading, isError, refetch, isFetching } = useMatches();
  const teams = useTeamMap();
  const del = useDeleteMatch();
  const approve = useApproveMatch();
  const isSuper = useAppSelector((s) => s.auth.user?.role === "SUPER_ADMIN");
  const { data: tournaments } = useTournaments();
  const { data: users } = useUsers(); // super-admin only; for the creator label
  const { data: venues } = useVenues();
  const [editId, setEditId] = useState<number | null>(null);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Matches</h2>
        <button className="btn-ghost text-xs" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>
      <div className="space-y-2">
        {isLoading && <p className="muted">Loading matches…</p>}
        {isError && (
          <p className="text-sm text-red-500">
            Couldn’t load matches (server may be waking up). Tap Refresh in a moment.
          </p>
        )}
        {(matches ?? []).map((m) => {
          const tour = tournaments?.find((tn) => tn.id === m.tournament_id);
          const creator = users?.find((u) => u.id === m.created_by_id);
          return (
          <div key={m.id} className="card-surface p-3">
            <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {tour && (
                <span className="mb-1 inline-block rounded bg-pitch-500/15 px-2 py-0.5 text-xs font-bold text-pitch-700 dark:text-pitch-300">
                  🏆 {tour.name}
                </span>
              )}
              <div className="truncate font-medium">
                {teamName(teams, m.team_a_id)} vs {teamName(teams, m.team_b_id)}
              </div>
              <div className="text-xs muted">
                {m.status.replace("_", " ")} · {m.overs_limit} ov
                {m.approved === false && (
                  <span className="ml-2 font-semibold text-amber-600">· Pending approval</span>
                )}
              </div>
              {isSuper && (
                <div className="text-xs muted">
                  {creator ? `Created by ${creator.full_name} ${creator.role === "SUPER_ADMIN" ? "👑" : "🛡️"}` : "Creator unknown"}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {m.approved === false && isSuper && (
                <button
                  className="rounded-lg bg-pitch-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pitch-600 disabled:opacity-50"
                  disabled={approve.isPending && approve.variables === m.id}
                  onClick={() => approve.mutate(m.id)}
                >
                  {approve.isPending && approve.variables === m.id ? "Approving…" : "Approve"}
                </button>
              )}
              {m.status === "SCHEDULED" && (
                <button className="btn-ghost text-sm" onClick={() => setEditId(editId === m.id ? null : m.id)}>
                  {editId === m.id ? "Close" : "Edit"}
                </button>
              )}
              {m.status === "COMPLETED" || m.status === "ABANDONED" ? (
                <Link to={`/matches/${m.id}`} className="btn-ghost text-sm">View</Link>
              ) : m.approved === false ? (
                <span className="text-xs muted">Approve to score</span>
              ) : (
                <Link to={`/admin/matches/${m.id}/score`} className="btn-primary text-sm">Score</Link>
              )}
              <button
                className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                title="Delete match + all its data"
                disabled={del.isPending && del.variables === m.id}
                onClick={() => {
                  if (confirm("Delete this match and ALL its data (scores, innings, balls)? This can't be undone.")) {
                    del.mutate(m.id);
                  }
                }}
              >
                {del.isPending && del.variables === m.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            </div>
            {editId === m.id && <EditMatchInline match={m} venues={venues ?? []} onDone={() => setEditId(null)} />}
          </div>
          );
        })}
        {!isLoading && !isError && !matches?.length && <p className="muted">No matches yet.</p>}
      </div>
    </div>
  );
}

// Inline editor for a scheduled match — time / venue / overs (teams are locked).
function EditMatchInline({
  match,
  venues,
  onDone,
}: {
  match: import("@/types").Match;
  venues: { id: number; name: string }[];
  onDone: () => void;
}) {
  const update = useUpdateMatch();
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [when, setWhen] = useState(toLocal(match.scheduled_at));
  const [venueId, setVenueId] = useState<number | "">(match.venue_id ?? "");
  const [overs, setOvers] = useState(match.overs_limit);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({
      id: match.id,
      body: {
        scheduled_at: when ? (when.length === 16 ? `${when}:00` : when) : undefined,
        venue_id: venueId === "" ? null : Number(venueId),
        overs_limit: overs,
      },
    });
    onDone();
  };

  return (
    <form onSubmit={save} className="mt-3 space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold text-pitch-600">Edit match — teams can't be changed</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Overs</span>
          <input className="input" type="number" min={1} max={100} value={overs} onChange={(e) => setOvers(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold muted">Venue</span>
          <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">— none —</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold muted">Date &amp; time</span>
        <DateTimePicker value={when} onChange={setWhen} />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1 text-sm" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn-ghost text-sm" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}
