import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMatches, useTeams, useVenues, useTournaments } from "@/api/hooks";
import { useCreateMatch, useCreateVenue, useDeleteVenue, useUsers } from "@/api/admin";
import { useTeamMap, teamName } from "@/hooks/useTeamMap";
import { useAppSelector } from "@/store";

export default function ManageMatches() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <CreateMatchForm />
        <CreateVenueForm />
        <VenueList />
      </div>
      <MatchList />
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
              className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10"
              onClick={() => {
                if (confirm(`Delete venue "${v.name}"?`)) del.mutate(v.id);
              }}
            >
              Delete
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (a === "" || b === "" || a === b) {
      setMsg("Pick two different teams.");
      return;
    }
    await create.mutateAsync({
      team_a_id: Number(a),
      team_b_id: Number(b),
      venue_id: venue === "" ? undefined : Number(venue),
      tournament_id: tournament === "" ? undefined : Number(tournament),
      overs_limit: overs,
      scheduled_at: when ? new Date(when).toISOString() : undefined,
      admin_ids: adminIds,
    });
    setMsg("✓ Match created (Upcoming). It goes LIVE automatically when you start scoring it — open it and tap “Score”.");
    setA(""); setB(""); setWhen(""); setAdminIds([]);
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
        <span className="mb-1 block text-xs font-semibold muted">Date &amp; time (optional)</span>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <select className="input" value={tournament} onChange={(e) => setTournament(Number(e.target.value))}>
        <option value="">Tournament (optional)</option>
        {(tournaments ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      {/* Super admins can grant scoring access to specific admins (optional). */}
      {isSuper && <AdminPicker selected={adminIds} onChange={setAdminIds} />}

      {msg && <p className="text-sm text-pitch-600">{msg}</p>}
      <button className="btn-primary w-full" disabled={create.isPending}>Create match</button>
    </form>
  );
}

function AdminPicker({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const { data: users } = useUsers();
  const admins = (users ?? []).filter((u) => u.role !== "PUBLIC" && u.is_active);
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  if (!admins.length) return null;
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold muted">
        Assign scorers (optional — you're always added; super admins can always score)
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
      <button className="btn-primary w-full" disabled={create.isPending}>Add venue</button>
    </form>
  );
}

function MatchList() {
  const { data: matches } = useMatches();
  const teams = useTeamMap();
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Matches</h2>
      <div className="space-y-2">
        {(matches ?? []).map((m) => (
          <div key={m.id} className="card-surface flex items-center justify-between p-3">
            <div>
              <div className="font-medium">
                {teamName(teams, m.team_a_id)} vs {teamName(teams, m.team_b_id)}
              </div>
              <div className="text-xs muted">{m.status.replace("_", " ")} · {m.overs_limit} ov</div>
            </div>
            <Link to={`/admin/matches/${m.id}/score`} className="btn-primary text-sm">Score</Link>
          </div>
        ))}
        {!matches?.length && <p className="muted">No matches yet.</p>}
      </div>
    </div>
  );
}
