import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTeams, useTournaments } from "@/api/hooks";
import { useApproveTournament, useCreateTournament, useGenerateFixtures } from "@/api/admin";
import { useAppSelector } from "@/store";

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
                <button className="btn-ghost text-xs disabled:opacity-50" disabled={approve.isPending && approve.variables === t.id} onClick={() => approve.mutate(t.id)}>
                  {approve.isPending && approve.variables === t.id ? "Approving…" : "Approve"}
                </button>
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
      <button className="btn-ghost text-xs disabled:opacity-50" onClick={run} disabled={gen.isPending}>
        {gen.isPending ? "Generating…" : "Generate fixtures"}
      </button>
      {msg && <span className="text-xs muted">{msg}</span>}
    </span>
  );
}
