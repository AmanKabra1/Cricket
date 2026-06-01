import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import BackgroundLayer from "./BackgroundLayer";
import { pageKey } from "@/lib/backgrounds";

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Drives the per-tab ambient accent (CSS) when no background image is set.
  useEffect(() => {
    document.body.dataset.page = pageKey(pathname);
  }, [pathname]);

  return (
    <div className="min-h-full">
      <BackgroundLayer />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-sm muted">
        LocalScore · Local cricket, live · Built for community grounds
      </footer>
    </div>
  );
}
