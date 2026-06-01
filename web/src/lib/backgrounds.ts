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

// Ultra-HD cricket wallpapers (direct image files). Super admin can override any
// of these per tab/mode in Manage → Appearance.
const W1 = "https://wallpaperaccess.com/full/4650746.jpg";
const W2 = "https://wallpaperaccess.com/full/4650798.jpg";
const W3 = "https://wallpaperaccess.com/full/4650915.jpg";

// Distinct image per tab (same for both modes — the overlay handles contrast).
export const DEFAULT_BACKGROUNDS: BgConfig = {
  home: { light: W1, dark: W1 },
  teams: { light: W2, dark: W2 },
  tournaments: { light: W3, dark: W3 },
  match: { light: W1, dark: W1 },
  admin: { light: W2, dark: W2 },
  auth: { light: W3, dark: W3 },
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
