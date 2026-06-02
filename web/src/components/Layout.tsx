import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import BackgroundLayer from "./BackgroundLayer";
import TopProgressBar from "./TopProgressBar";
import { pageKey } from "@/lib/backgrounds";

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Drives the per-tab ambient accent (CSS) when no background image is set.
  useEffect(() => {
    document.body.dataset.page = pageKey(pathname);
  }, [pathname]);

  return (
    <div className="min-h-full">
      <TopProgressBar />
      <BackgroundLayer />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-center text-sm muted">
        <div>LocalScore · Local cricket, live · Built for community grounds</div>
        <div className="mt-1 text-xs">
          © {new Date().getFullYear()} LocalScore. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
