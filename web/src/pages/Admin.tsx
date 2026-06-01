import { useState } from "react";
import ManageTeams from "./admin/ManageTeams";
import ManageMatches from "./admin/ManageMatches";
import ManageTournaments from "./admin/ManageTournaments";
import ManageUsers from "./admin/ManageUsers";
import { useAppSelector } from "@/store";

export default function Admin() {
  const user = useAppSelector((s) => s.auth.user);
  const isSuper = user?.role === "SUPER_ADMIN";
  // Only super admins see the "Admins" tab (user/role management).
  const TABS = isSuper
    ? (["Teams & players", "Matches", "Tournaments", "Admins"] as const)
    : (["Teams & players", "Matches", "Tournaments"] as const);
  const [tab, setTab] = useState<string>("Teams & players");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Manage</h1>
        <p className="muted">
          Signed in as {user?.full_name} ({user?.role.replace("_", " ").toLowerCase()})
        </p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t ? "border-pitch-500 text-pitch-600" : "border-transparent muted hover:text-pitch-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Teams & players" && <ManageTeams />}
      {tab === "Matches" && <ManageMatches />}
      {tab === "Tournaments" && <ManageTournaments />}
      {tab === "Admins" && isSuper && <ManageUsers />}
    </div>
  );
}
