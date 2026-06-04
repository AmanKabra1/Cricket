// Per-screen background config — mirrors web/src/lib/backgrounds.ts. The DB
// stores only URLs (set by the super admin in Appearance); these HD defaults
// look good out of the box. A readability overlay is applied on top.

export type Mode = "light" | "dark";
export interface BgEntry { light?: string | null; dark?: string | null }
export type BgConfig = Record<string, BgEntry>;

export const BG_PAGES = ["home", "teams", "tournaments", "match", "admin", "auth"] as const;
export type BgPage = (typeof BG_PAGES)[number];

// No remote default wallpapers on mobile: a clean solid background loads
// instantly and feels native. The super admin can still set a per-page image in
// Manage → Appearance, which then shows. (Web keeps its own HD defaults.)
export const DEFAULT_BACKGROUNDS: BgConfig = {};

/** Map an expo-router pathname to a background page key. */
export function pageKey(pathname: string): BgPage {
  if (pathname.startsWith("/team")) return "teams";
  if (pathname.startsWith("/tournament")) return "tournaments";
  if (pathname.startsWith("/match") || pathname.startsWith("/score")) return "match";
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
