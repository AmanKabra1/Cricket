import { useState, type FormEvent, type ReactNode } from "react";
import { useTeams, useTeam } from "@/api/hooks";
import {
  useAddPlayer,
  useCreateTeam,
  useDeletePlayer,
  useDeleteTeam,
  useUpdateTeam,
  type PlayerInput,
} from "@/api/admin";
import ImageUpload from "@/components/ImageUpload";
import Spinner from "@/components/Spinner";

const ROLES = ["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"];
const BAT = ["RIGHT_HAND", "LEFT_HAND"];
// Standard cricket bowling types (pace + spin, both arms).
const BOWLING_TYPES = [
  "None",
  "Right-arm fast",
  "Right-arm fast-medium",
  "Right-arm medium",
  "Right-arm off-break",
  "Right-arm leg-break",
  "Left-arm fast",
  "Left-arm fast-medium",
  "Left-arm medium",
  "Left-arm orthodox",
  "Left-arm wrist-spin",
];
const bowls = (role?: string) => role === "BOWLER" || role === "ALL_ROUNDER";

export default function ManageTeams() {
  const { data: teams } = useTeams();
  const [selected, setSelected] = useState<number | null>(null);
  const deleteTeam = useDeleteTeam();

  const onDelete = async (id: number, name: string) => {
    if (!confirm(`Delete team "${name}"? This removes its players too.`)) return;
    try {
      await deleteTeam.mutateAsync(id);
      if (selected === id) setSelected(null);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Couldn't delete team");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="mb-3 text-lg font-bold">Create team</h2>
        <CreateTeamForm onCreated={(id) => setSelected(id)} />

        <h3 className="mb-2 mt-6 font-bold">Teams</h3>
        <div className="space-y-2">
          {(teams ?? []).map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-lg border p-2 shadow-sm ${
                selected === t.id ? "border-pitch-500" : ""
              }`}
              style={{
                borderColor: selected === t.id ? undefined : "var(--border)",
                background: "var(--surface)",
              }}
            >
              <button onClick={() => setSelected(t.id)} className="flex flex-1 items-center gap-3 text-left">
                {t.logo_url ? (
                  <img src={t.logo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch-100 text-xs font-bold text-pitch-700 dark:bg-navy-700">
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="font-medium">{t.name}</span>
              </button>
              <button
                onClick={() => onDelete(t.id, t.name)}
                disabled={deleteTeam.isPending && deleteTeam.variables === t.id}
                className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                title="Delete team"
              >
                {deleteTeam.isPending && deleteTeam.variables === t.id ? "Deleting…" : "Delete"}
              </button>
            </div>
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
  const deletePlayer = useDeletePlayer(teamId);

  const blank: PlayerInput = { name: "", role: "BATSMAN", batting_style: "RIGHT_HAND", bowling_style: "None" };
  const [p, setP] = useState<PlayerInput>(blank);
  const [photo, setPhoto] = useState<string | undefined>();

  if (isLoading || !team) return <Spinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // A non-bowler stores "None" as the bowling type.
    const payload = { ...p, bowling_style: bowls(p.role) ? p.bowling_style : "None", photo_url: photo };
    await addPlayer.mutateAsync(payload);
    setP(blank);
    setPhoto(undefined);
  };

  const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold muted">{label}</span>
      {children}
    </label>
  );

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{team.name} — squad ({team.players.length})</h2>

      <form onSubmit={submit} className="card-surface mb-4 space-y-3 p-4">
        <Field label="Player name *">
          <input className="input" placeholder="e.g. Rohit Sharma" value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select className="input" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Jersey number">
            <input className="input" type="number" min={0} max={999} placeholder="e.g. 7"
              value={p.jersey_number ?? ""}
              onChange={(e) => {
                const n = Math.max(0, Number(e.target.value));
                setP({ ...p, jersey_number: e.target.value === "" ? undefined : n });
              }} />
          </Field>
          <Field label="Batting style">
            <select className="input" value={p.batting_style} onChange={(e) => setP({ ...p, batting_style: e.target.value })}>
              {BAT.map((b) => <option key={b} value={b}>{b.replace("_", " ")}</option>)}
            </select>
          </Field>
          {bowls(p.role) && (
            <Field label="Bowling type">
              <select className="input" value={p.bowling_style} onChange={(e) => setP({ ...p, bowling_style: e.target.value })}>
                {BOWLING_TYPES.filter((b) => b !== "None").map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          )}
        </div>
        <ImageUpload category="player_photo" label="Photo" value={photo} onChange={setPhoto} />
        <button className="btn-primary w-full" disabled={addPlayer.isPending}>{addPlayer.isPending ? "Adding…" : "Add player"}</button>
      </form>

      <div className="card-surface divide-y" style={{ borderColor: "var(--border)" }}>
        {team.players.map((pl) => (
          <div
            key={pl.id}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Player info */}
            <div className="flex min-w-0 items-center gap-2">
              {pl.photo_url ? (
                <img src={pl.photo_url} className="h-8 w-8 shrink-0 rounded-full object-cover" alt="" />
              ) : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-500/10 text-xs muted">
                  {pl.jersey_number ?? "–"}
                </span>
              )}
              <span className="min-w-0 font-medium">
                <span className="truncate">{pl.name}</span>
                {team.captain_id === pl.id && <Badge>C</Badge>}
                {team.vice_captain_id === pl.id && <Badge>VC</Badge>}
                {team.wicket_keeper_id === pl.id && <Badge>WK</Badge>}
                <span className="ml-2 block text-xs muted">
                  {pl.role.replace("_", " ")}
                  {bowls(pl.role) && pl.bowling_style !== "None" ? ` · ${pl.bowling_style}` : ""}
                </span>
              </span>
            </div>
            {/* Role actions — each role goes to exactly one player. A "Make X"
                button shows only if that role is unassigned AND this player holds
                no role yet; the holder gets a "Clear" to free it up. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(() => {
                const isC = team.captain_id === pl.id;
                const isVC = team.vice_captain_id === pl.id;
                const isWK = team.wicket_keeper_id === pl.id;
                const hasRole = isC || isVC || isWK;
                const busy = update.isPending;
                return (
                  <>
                    {!team.captain_id && !hasRole && (
                      <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ captain_id: pl.id })}>Make C</button>
                    )}
                    {!team.vice_captain_id && !hasRole && (
                      <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ vice_captain_id: pl.id })}>Make VC</button>
                    )}
                    {!team.wicket_keeper_id && !hasRole && (
                      <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ wicket_keeper_id: pl.id })}>Make WK</button>
                    )}
                    {isC && <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ captain_id: null })}>Clear C</button>}
                    {isVC && <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ vice_captain_id: null })}>Clear VC</button>}
                    {isWK && <button disabled={busy} className="btn-ghost text-xs disabled:opacity-50" onClick={() => update.mutate({ wicket_keeper_id: null })}>Clear WK</button>}
                  </>
                );
              })()}
              <button
                className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                title="Remove player"
                onClick={async () => {
                  if (!confirm(`Remove ${pl.name}?`)) return;
                  try {
                    await deletePlayer.mutateAsync(pl.id);
                  } catch (e: unknown) {
                    alert((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Couldn't remove player");
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {!team.players.length && <p className="p-4 muted">No players yet.</p>}
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 rounded bg-pitch-100 px-1.5 text-xs font-bold text-pitch-700 dark:bg-navy-700 dark:text-pitch-300">
      {children}
    </span>
  );
}
