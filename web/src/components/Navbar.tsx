import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTheme } from "@/theme/ThemeContext";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout } from "@/store/authSlice";

const navItem = (isActive: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
    isActive ? "bg-pitch-500 text-white" : "hover:bg-pitch-50 dark:hover:bg-navy-700"
  }`;

const mobileItem = (isActive: boolean) =>
  `block rounded-lg px-3 py-2 font-medium transition ${
    isActive ? "bg-pitch-500 text-white" : "hover:bg-pitch-50 dark:hover:bg-navy-700"
  }`;

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = !!user && user.role !== "PUBLIC";
  const isSuper = user?.role === "SUPER_ADMIN";
  const roleLabel = isSuper ? "Super Admin" : "Match Admin";
  const roleIcon = isSuper ? "👑" : "🛡️";
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-pitch-500 font-black text-white">
            LS
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            Local<span className="text-pitch-500">Score</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" className={({ isActive }) => navItem(isActive)} end>Home</NavLink>
          <NavLink to="/teams" className={({ isActive }) => navItem(isActive)}>Teams</NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => navItem(isActive)}>Tournaments</NavLink>
          <NavLink to="/leaderboards" className={({ isActive }) => navItem(isActive)}>Stats</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => navItem(isActive)}>Manage</NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {isAdmin ? (
            <>
              <span
                className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex"
                style={{ background: "var(--surface-2, rgba(120,120,120,.12))", color: "var(--text)" }}
                title={`Signed in as ${roleLabel}`}
              >
                <span>{roleIcon}</span>
                <span>{roleLabel}</span>
              </span>
              <button className="hidden btn-ghost sm:inline-flex" onClick={() => dispatch(logout())}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="hidden btn-primary sm:inline-flex">Admin</Link>
          )}
          {/* Mobile hamburger */}
          <button
            className="btn-ghost sm:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <nav className="border-t px-4 py-3 sm:hidden" style={{ borderColor: "var(--border)" }}>
          <NavLink to="/" end className={({ isActive }) => mobileItem(isActive)}>Home</NavLink>
          <NavLink to="/teams" className={({ isActive }) => mobileItem(isActive)}>Teams</NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => mobileItem(isActive)}>Tournaments</NavLink>
          <NavLink to="/leaderboards" className={({ isActive }) => mobileItem(isActive)}>Stats</NavLink>
          {isAdmin && <NavLink to="/admin" className={({ isActive }) => mobileItem(isActive)}>Manage</NavLink>}
          <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
            {isAdmin ? (
              <>
                <div className="px-3 py-1 text-xs font-bold muted">
                  {roleIcon} {roleLabel}
                </div>
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left font-medium hover:bg-pitch-50 dark:hover:bg-navy-700"
                  onClick={() => dispatch(logout())}
                >
                  Logout ({user?.full_name})
                </button>
              </>
            ) : (
              <NavLink to="/login" className={({ isActive }) => mobileItem(isActive)}>Admin sign in</NavLink>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
