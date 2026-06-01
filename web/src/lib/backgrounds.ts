// Per-tab background config. The DB stores only URLs (set by the super admin);
// these HD defaults make it look good out of the box. A readability overlay is
// applied on top (see BackgroundLayer), so any image works in light & dark.

export type Mode = "light" | "dark";
export interface BgEntry {
  light?: string | null;
  dark?: string | null;
}
export type BgConfig = Record<string, BgEntry>;

export const BG_PAGES = ["home", "teams", "tournaments", "match", "admin", "auth"] as const;
export type BgPage = (typeof BG_PAGES)[number];

const hd = (seed: string) => `https://picsum.photos/seed/${seed}/1920/1080`;

// Distinct default image per tab (same for both modes — overlay handles contrast).
export const DEFAULT_BACKGROUNDS: BgConfig = {
  home: { light: hd("localscore-home"), dark: hd("localscore-home") },
  teams: { light: hd("localscore-teams"), dark: hd("localscore-teams") },
  tournaments: { light: hd("localscore-trophy"), dark: hd("localscore-trophy") },
  match: { light: hd("localscore-match"), dark: hd("localscore-match") },
  admin: { light: hd("localscore-admin"), dark: hd("localscore-admin") },
  auth: { light: hd("localscore-auth"), dark: hd("localscore-auth") },
};

export function pageKey(pathname: string): BgPage {
  if (pathname.startsWith("/teams")) return "teams";
  if (pathname.startsWith("/tournaments")) return "tournaments";
  if (pathname.startsWith("/matches") || pathname.startsWith("/admin/matches")) return "match";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/login")) return "auth";
  return "home";
}

/** Resolve the background URL for a page + theme, falling back sensibly. */
export function resolveBackground(cfg: BgConfig | undefined, page: BgPage, mode: Mode): string | null {
  const entry = { ...DEFAULT_BACKGROUNDS[page], ...(cfg?.[page] ?? {}) };
  const url = mode === "dark" ? entry.dark || entry.light : entry.light || entry.dark;
  return url || null;
}
