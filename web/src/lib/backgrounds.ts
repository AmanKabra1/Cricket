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

// Cricket-themed images by keyword (LoremFlickr, Creative-Commons, no API key).
// `lock` pins a stable image per tab so it doesn't change on every load.
const cricket = (tags: string, lock: number) =>
  `https://loremflickr.com/1920/1080/${tags}?lock=${lock}`;

// Distinct cricket image per tab (same for both modes — overlay handles contrast).
export const DEFAULT_BACKGROUNDS: BgConfig = {
  home: { light: cricket("cricket,stadium", 11), dark: cricket("cricket,stadium", 11) },
  teams: { light: cricket("cricket,team", 22), dark: cricket("cricket,team", 22) },
  tournaments: { light: cricket("cricket,trophy", 33), dark: cricket("cricket,trophy", 33) },
  match: { light: cricket("cricket,batsman", 44), dark: cricket("cricket,batsman", 44) },
  admin: { light: cricket("cricket,ground,pitch", 55), dark: cricket("cricket,ground,pitch", 55) },
  auth: { light: cricket("cricket,ball", 66), dark: cricket("cricket,ball", 66) },
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
