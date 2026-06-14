import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the public site URL.
// To switch domains later: change THIS line (or set VITE_SITE_URL in the env).
// Everything below — index.html OG/canonical tags, robots.txt, sitemap.xml —
// is derived from it automatically. No other file needs editing.
const SITE_URL = (process.env.VITE_SITE_URL || "https://cricket-inky-zeta.vercel.app").replace(/\/+$/, "");
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES = ["/", "/teams", "/tournaments", "/leaderboards"];

// Injects SITE_URL into index.html (%placeholder%) and emits robots.txt +
// sitemap.xml at build time, so the domain lives in exactly one place.
function seo(): Plugin {
  return {
    name: "localscore-seo",
    transformIndexHtml(html) {
      return html.replace(/__SITE_URL__/g, SITE_URL);
    },
    generateBundle() {
      const urls = PUBLIC_ROUTES.map(
        (r) => `  <url><loc>${SITE_URL}${r}</loc></url>`,
      ).join("\n");
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), seo()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev convenience: proxy API + websocket to the backend.
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8000", ws: true, changeOrigin: true },
    },
  },
});
