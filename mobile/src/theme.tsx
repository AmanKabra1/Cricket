import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const palette = {
  pitch: "#16a34a",
  pitchDark: "#039855",
  navy: "#0b1220",
  amber: "#f59e0b",
  red: "#ef4444",
};

export interface Theme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
}

const light: Theme = {
  bg: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  primary: palette.pitch,
};

const dark: Theme = {
  bg: palette.navy,
  surface: "#0f172a",
  text: "#e2e8f0",
  muted: "#94a3b8",
  border: "#1e293b",
  primary: palette.pitch,
};

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";
const KEY = "localscore.themeMode";

interface ModeCtx {
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ModeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setModeState(v);
    }).catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };
  const resolved: Resolved = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const toggle = () => setMode(resolved === "dark" ? "light" : "dark");

  return <Ctx.Provider value={{ mode, resolved, setMode, toggle }}>{children}</Ctx.Provider>;
}

/** Mode controls for a theme switcher. Falls back to system if no provider. */
export function useThemeMode(): ModeCtx {
  const c = useContext(Ctx);
  const system = useColorScheme();
  if (c) return c;
  const resolved: Resolved = system === "dark" ? "dark" : "light";
  return { mode: "system", resolved, setMode: () => {}, toggle: () => {} };
}

/** The active color palette for the chosen mode. */
export function useTheme(): Theme {
  return useThemeMode().resolved === "dark" ? dark : light;
}
