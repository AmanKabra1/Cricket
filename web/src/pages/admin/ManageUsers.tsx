import { useState, type FormEvent } from "react";
import { useCreateUser, useDeleteUser, useSetUserActive, useSetUserRole, useTestEmail, useUsers } from "@/api/admin";
import { useAppSelector } from "@/store";
import Spinner from "@/components/Spinner";
import type { User } from "@/types";

const ROLES = ["MATCH_ADMIN", "SUPER_ADMIN", "PUBLIC"];

export default function ManageUsers() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CreateAdminForm />
      <UsersList />
    </div>
  );
}

function CreateAdminForm() {
  const create = useCreateUser();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MATCH_ADMIN");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await create.mutateAsync({ email, full_name: fullName, password, role });
      setMsg(`Created ${email} as ${role.replace("_", " ")}.`);
      setEmail(""); setFullName(""); setPassword("");
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to create user");
    }
  };

  return (
    <form onSubmit={submit} className="card-surface space-y-3 p-4">
      <h2 className="text-lg font-bold">Create admin</h2>
      <p className="text-sm muted">Add a match admin (umpire/scorer) or another super admin.</p>
      <input className="input" placeholder="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <input className="input" type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="Password (min 8 chars) *" value={password}
        onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="MATCH_ADMIN">Match Admin (scorer)</option>
        <option value="SUPER_ADMIN">Super Admin</option>
      </select>
      {msg && <p className="text-sm text-pitch-600">{msg}</p>}
      <button className="btn-primary w-full" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create admin"}
      </button>
      <TestEmailButton />
    </form>
  );
}

function TestEmailButton() {
  const test = useTestEmail();
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setResult(null);
    try {
      const r = await test.mutateAsync();
      setResult(r.detail);
    } catch {
      setResult("Couldn't reach the server to send a test email.");
    }
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
      <p className="mb-2 text-xs muted">
        New admins are emailed their login. If they aren't receiving it, send a test to yourself to check SMTP.
      </p>
      <button type="button" className="btn-ghost w-full text-sm" disabled={test.isPending} onClick={run}>
        {test.isPending ? "Sending…" : "Send test email to me"}
      </button>
      {result && <p className="mt-2 text-sm muted">{result}</p>}
    </div>
  );
}

function UsersList() {
  const { data, isLoading } = useUsers();
  const setRole = useSetUserRole();
  const setActive = useSetUserActive();
  const del = useDeleteUser();
  const meId = useAppSelector((s) => s.auth.user?.id);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Users ({data?.length ?? 0})</h2>
      <div className="card-surface divide-y" style={{ borderColor: "var(--border)" }}>
        {(data ?? []).map((u: User) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 p-3" style={{ borderColor: "var(--border)" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {u.full_name} {!u.is_active && <span className="text-xs text-red-500">(disabled)</span>}
              </div>
              <div className="truncate text-xs muted">{u.email}</div>
            </div>
            <select
              className="input max-w-[9rem] text-xs"
              value={u.role}
              onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
            <button
              className="btn-ghost text-xs"
              onClick={() => setActive.mutate({ id: u.id, is_active: !u.is_active })}
            >
              {u.is_active ? "Disable" : "Enable"}
            </button>
            {u.id !== meId && (
              <button
                className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                title="Delete user + their assigned matches"
                onClick={() => {
                  if (confirm(`Delete ${u.full_name}? This also deletes matches assigned to them and all that match data.`)) {
                    del.mutate(u.id);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {!data?.length && <p className="p-4 muted">No users yet.</p>}
      </div>
    </div>
  );
}
