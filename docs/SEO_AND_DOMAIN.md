# LocalScore — SEO, Social Previews & Domain

How link previews (LinkedIn/WhatsApp/etc.), Google indexing, and the site URL are
wired — and what to do to publish/maintain them.

Current site URL: **https://cricket-one-flax.vercel.app**

---

## 1. Single source of truth for the site URL
The domain lives in **one place** — `SITE_URL` in [`web/vite.config.ts`](../web/vite.config.ts)
(overridable with the `VITE_SITE_URL` env var on Vercel):

```ts
const SITE_URL = (process.env.VITE_SITE_URL || "https://cricket-one-flax.vercel.app").replace(/\/+$/, "");
```

A small Vite **SEO plugin** derives everything from it at build time:
- Injects it into `index.html` (the `__SITE_URL__` placeholder) for `og:url`,
  `og:image`, `twitter:image`, `canonical`, and the JSON-LD `url`.
- **Generates** `robots.txt` and `sitemap.xml` into the build output.

There are **no static** `robots.txt` / `sitemap.xml` to keep in sync.

### To change the domain later (one change)
Either edit the `SITE_URL` line, **or** set `VITE_SITE_URL` in Vercel → Settings →
Environment Variables. Then redeploy — OG tags, canonical, robots and sitemap all
update together. Also update the backend `FRONTEND_URL` + `BACKEND_CORS_ORIGINS`
(Render) and add the new property in Google Search Console.

---

## 2. Social preview card (Open Graph / Twitter)
`web/index.html` has the full tag set: `og:type/site_name/title/description/url/
image (+width/height)` and `twitter:card/title/description/image`.

The preview image is **`web/public/og-image.png`** (1200×630, branded), served at
`/og-image.png`. Source art: `web/public/og-image.svg`.

**Regenerate the image** after editing the SVG:
```bash
cd web && npm run og        # rasterizes og-image.svg → og-image.png via sharp
```

> Unfurlers (LinkedIn/WhatsApp/Facebook/X/Discord/Telegram) need a **PNG/JPG** —
> an SVG favicon is not enough. That was why the preview showed a generic icon.

### Validate / refresh previews
- **LinkedIn:** https://www.linkedin.com/post-inspector/ → paste the URL → Inspect
  (this also **busts LinkedIn's cache** — required after any change).
- **Facebook / generic OG:** https://developers.facebook.com/tools/debug/ → Scrape Again.
- **Open Graph:** https://www.opengraph.xyz/ · **X:** https://cards-dev.twitter.com/validator

---

## 3. Get indexed by Google
`robots.txt` (allows crawl, blocks `/admin` + `/login`) and `sitemap.xml` (public
routes) are generated at build; `index.html` has `robots: index,follow`, a
canonical, and WebSite JSON-LD.

**Steps (one-time):**
1. **Google Search Console** → https://search.google.com/search-console → **Add
   property** → **URL prefix** → the site URL.
2. **Verify** (easiest = *HTML tag*): uncomment the `google-site-verification`
   meta in `index.html`, paste the token, push → Vercel redeploys → click Verify.
3. **Sitemaps** → submit `sitemap.xml`.
4. **URL Inspection** → paste the homepage → **Request indexing** (repeat for
   `/teams`, `/tournaments`, `/leaderboards`).
5. Check with `site:cricket-one-flax.vercel.app` in Google after a few hours–days.
6. (Optional) **Bing Webmaster Tools** — import from Search Console.

> **SPA note:** Googlebot renders JS, so the client-rendered pages index — but all
> routes share the same `<title>`/description (from `index.html`). Fine for the
> brand query "LocalScore". For per-page ranking later, add prerendering/SSR
> (e.g. `vite-react-ssg`) + per-route titles.

---

## 4. A nicer domain (all free options)
A custom domain is **not required** — the `.vercel.app` URL indexes and shares
fine. Free ways to a nicer URL:

| Option | Result | Notes |
|---|---|---|
| **Rename the Vercel project** | `localscore.vercel.app` | Free, instant — recommended |
| **is-a.dev** (GitHub PR) | `localscore.is-a.dev` | Free; CNAME → `cname.vercel-dns.com` |
| **js.org** (GitHub PR) | `localscore.js.org` | Free for open-source |
| **GitHub Student Pack** | free `.me`/`.tech` 1 yr | If you're a student |

Avoid Freenom (.tk/.ml) — unreliable/dead. To attach any domain: Vercel → project
→ Settings → Domains → Add → set the shown A/CNAME records at your DNS provider →
Vercel auto-issues free HTTPS.
