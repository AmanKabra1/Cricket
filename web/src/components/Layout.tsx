import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";

function pageKey(pathname: string): string {
  if (pathname.startsWith("/teams")) return "teams";
  if (pathname.startsWith("/tournaments")) return "tournaments";
  if (pathname.startsWith("/matches") || pathname.startsWith("/admin/matches")) return "match";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/login")) return "auth";
  return "home";
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Drives the per-tab ambient background accent (see index.css body[data-page]).
  useEffect(() => {
    document.body.dataset.page = pageKey(pathname);
  }, [pathname]);

  return (
    <div className="min-h-full">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-sm muted">
        LocalScore · Local cricket, live · Built for community grounds
      </footer>
    </div>
  );
}
