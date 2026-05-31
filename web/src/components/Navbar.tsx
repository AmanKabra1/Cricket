import { Link, NavLink } from "react-router-dom";
import { useTheme } from "@/theme/ThemeContext";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout } from "@/store/authSlice";

const navItem = (isActive: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
    isActive ? "bg-pitch-500 text-white" : "hover:bg-pitch-50 dark:hover:bg-navy-700"
  }`;

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  return (
    <header
      className="sticky top-0 z-20 border-b backdrop-blur"
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

        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" className={({ isActive }) => navItem(isActive)} end>
            Home
          </NavLink>
          <NavLink to="/teams" className={({ isActive }) => navItem(isActive)}>
            Teams
          </NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => navItem(isActive)}>
            Tournaments
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {user && user.role !== "PUBLIC" ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm muted sm:inline">{user.full_name}</span>
              <button className="btn-ghost" onClick={() => dispatch(logout())}>
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary">
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
