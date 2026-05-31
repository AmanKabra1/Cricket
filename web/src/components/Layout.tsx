import type { ReactNode } from "react";
import Navbar from "./Navbar";

export default function Layout({ children }: { children: ReactNode }) {
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
