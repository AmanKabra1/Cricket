import { useLocation } from "react-router-dom";
import { useBackgrounds } from "@/api/hooks";
import { useTheme } from "@/theme/ThemeContext";
import { pageKey, resolveBackground } from "@/lib/backgrounds";

/**
 * Fixed, full-viewport background image for the current tab + theme, with a
 * readability overlay so content stays legible in both light and dark. `cover`
 * sizing keeps it responsive on mobile.
 */
export default function BackgroundLayer() {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const { data } = useBackgrounds();
  const url = resolveBackground(data, pageKey(pathname), theme);
  if (!url) return null;

  const overlay =
    theme === "dark"
      ? "linear-gradient(rgba(11,18,32,0.82), rgba(11,18,32,0.92))"
      : "linear-gradient(rgba(248,250,252,0.84), rgba(248,250,252,0.92))";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `${overlay}, url("${url}")` }}
    />
  );
}
