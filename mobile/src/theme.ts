import { useColorScheme } from "react-native";

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

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
