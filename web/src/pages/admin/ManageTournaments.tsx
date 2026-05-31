import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTeams, useTournaments } from "@/api/hooks";
import { useApproveTournament, useCreateTournament, useGenerateFixtures } from "@/api/admin";
import { useAppSelector } from "@/store";

const FORMATS = ["LEAGUE", "ROUND_ROBIN", "KNOCKOUT", "GROUP_STAGE"];

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
        {FORMATS.map((f) => <option key={f}>{f}</option>)}
      </select>
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
      <button className="btn-primary w-full" disabled={create.isPending || picked.size < 2}>
        Create tournament
      </button>
      <p className="text-xs muted">Pick at least 2 teams. Generate fixtures after creating.</p>
    </form>
  );
}

function TournamentList() {
  const { data: tournaments } = useTournaments();
  const user = useAppSelector((s) => s.auth.user);
  const approve = useApproveTournament();

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Tournaments</h2>
      <div className="space-y-2">
        {(tournaments ?? []).map((t) => (
          <div key={t.id} className="card-surface p-3">
            <div className="flex items-center justify-between">
              <Link to={`/tournaments/${t.id}`} className="font-medium hover:text-pitch-600">{t.name}</Link>
              <span className="text-xs muted">{t.format.replace("_", " ")} · {t.status}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <FixturesButton tournamentId={t.id} />
              {user?.role === "SUPER_ADMIN" && t.status === "PENDING" && (
                <button className="btn-ghost text-xs" onClick={() => approve.mutate(t.id)}>Approve</button>
              )}
            </div>
          </div>
        ))}
        {!tournaments?.length && <p className="muted">No tournaments yet.</p>}
      </div>
    </div>
  );
}

function FixturesButton({ tournamentId }: { tournamentId: number }) {
  const gen = useGenerateFixtures(tournamentId);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    try {
      await gen.mutateAsync();
      setMsg("Fixtures generated");
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed");
    }
  };
  return (
    <span className="flex items-center gap-2">
      <button className="btn-ghost text-xs" onClick={run} disabled={gen.isPending}>Generate fixtures</button>
      {msg && <span className="text-xs muted">{msg}</span>}
    </span>
  );
}
