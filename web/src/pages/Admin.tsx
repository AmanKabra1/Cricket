import { useState } from "react";
import ManageTeams from "./admin/ManageTeams";
import ManageMatches from "./admin/ManageMatches";
import ManageTournaments from "./admin/ManageTournaments";
import { useAppSelector } from "@/store";

const TABS = ["Teams & players", "Matches", "Tournaments"] as const;
type Tab = (typeof TABS)[number];

export default function Admin() {
  const [tab, setTab] = useState<Tab>("Teams & players");
  const user = useAppSelector((s) => s.auth.user);

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
    </div>
  );
}
