import { useState, type FormEvent } from "react";
import { useTeams, useTeam } from "@/api/hooks";
import { useAddPlayer, useCreateTeam, useUpdateTeam, type PlayerInput } from "@/api/admin";
import ImageUpload from "@/components/ImageUpload";
import Spinner from "@/components/Spinner";

const ROLES = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
const BAT = ["RIGHT_HAND", "LEFT_HAND"];
const BOWL = ["NONE", "FAST", "MEDIUM", "OFF_SPIN", "LEG_SPIN", "LEFT_ARM_SPIN", "LEFT_ARM_FAST"];

export default function ManageTeams() {
  const { data: teams } = useTeams();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="mb-3 text-lg font-bold">Create team</h2>
        <CreateTeamForm onCreated={(id) => setSelected(id)} />

        <h3 className="mb-2 mt-6 font-bold">Teams</h3>
        <div className="space-y-2">
          {(teams ?? []).map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left ${
                selected === t.id ? "border-pitch-500" : ""
              }`}
              style={{ borderColor: selected === t.id ? undefined : "var(--border)" }}
            >
              {t.logo_url ? (
                <img src={t.logo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch-100 text-xs font-bold text-pitch-700 dark:bg-navy-700">
                  {t.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="font-medium">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {selected ? (
          <TeamEditor teamId={selected} />
        ) : (
          <p className="muted">Select or create a team to manage its squad.</p>
        )}
      </div>
    </div>
  );
}

function CreateTeamForm({ onCreated }: { onCreated: (id: number) => void }) {
  const create = useCreateTeam();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [coach, setCoach] = useState("");
  const [logo, setLogo] = useState<string | undefined>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const team = await create.mutateAsync({ name, city, coach, logo_url: logo });
    setName(""); setCity(""); setCoach(""); setLogo(undefined);
    onCreated(team.id);
  };

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-4">
      <input className="input" placeholder="Team name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className="input" placeholder="Coach" value={coach} onChange={(e) => setCoach(e.target.value)} />
      </div>
      <ImageUpload category="team_logo" label="Logo" value={logo} onChange={setLogo} />
      <button className="btn-primary w-full" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

function TeamEditor({ teamId }: { teamId: number }) {
  const { data: team, isLoading } = useTeam(teamId);
  const addPlayer = useAddPlayer(teamId);
  const update = useUpdateTeam(teamId);

  const [p, setP] = useState<PlayerInput>({ name: "", role: "BATSMAN", batting_style: "RIGHT_HAND", bowling_style: "NONE" });
  const [photo, setPhoto] = useState<string | undefined>();

  if (isLoading || !team) return <Spinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await addPlayer.mutateAsync({ ...p, photo_url: photo });
    setP({ name: "", role: "BATSMAN", batting_style: "RIGHT_HAND", bowling_style: "NONE" });
    setPhoto(undefined);
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{team.name} — squad ({team.players.length})</h2>

      <form onSubmit={submit} className="card-surface mb-4 space-y-3 p-4">
        <input className="input" placeholder="Player name *" value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <input className="input" type="number" placeholder="Jersey #"
            onChange={(e) => setP({ ...p, jersey_number: Number(e.target.value) || undefined })} />
          <select className="input" value={p.batting_style} onChange={(e) => setP({ ...p, batting_style: e.target.value })}>
            {BAT.map((b) => <option key={b}>{b}</option>)}
          </select>
          <select className="input" value={p.bowling_style} onChange={(e) => setP({ ...p, bowling_style: e.target.value })}>
            {BOWL.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <ImageUpload category="player_photo" label="Photo" value={photo} onChange={setPhoto} />
        <button className="btn-primary w-full" disabled={addPlayer.isPending}>Add player</button>
      </form>

      <div className="card-surface divide-y" style={{ borderColor: "var(--border)" }}>
        {team.players.map((pl) => (
          <div key={pl.id} className="flex items-center gap-3 p-3" style={{ borderColor: "var(--border)" }}>
            {pl.photo_url ? (
              <img src={pl.photo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-500/10 text-xs muted">{pl.jersey_number ?? "–"}</span>
            )}
            <span className="flex-1 font-medium">
              {pl.name}
              {team.captain_id === pl.id && <span className="ml-2 rounded bg-pitch-100 px-1.5 text-xs font-bold text-pitch-700">C</span>}
            </span>
            <span className="text-xs muted">{pl.role.replace("_", " ")}</span>
            {team.captain_id !== pl.id && (
              <button className="btn-ghost text-xs" onClick={() => update.mutate({ captain_id: pl.id })}>
                Make captain
              </button>
            )}
          </div>
        ))}
        {!team.players.length && <p className="p-4 muted">No players yet.</p>}
      </div>
    </div>
  );
}
