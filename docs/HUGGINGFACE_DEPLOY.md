# LocalScore — Deploy AI + Backend on Hugging Face (free) + SEO go-live

A complete runbook to host the **AI service** and the **backend** on free Hugging
Face Docker Spaces, point the **web** at them, unblock Vercel, and get into Google.

## Where the changes are
- **App code:** none needed. Dockerfiles, ports (`app_port` → HF sets `$PORT` to
  match), and CORS (`allow_origins … or ["*"]`) already work on HF. README
  front-matter + the two GitHub workflows are already committed.
- **Config you set (no coding):** 2 HF Spaces + their Secrets, 1 GitHub secret,
  Vercel env vars, GitHub repo visibility, Google Search Console.

> HF Spaces are free, have **no monthly hour cap**, and sleep only after **48h**
> idle. Uploads are **ephemeral** on HF — set `STORAGE_BACKEND=s3` + `S3_*`
> (Cloudflare R2) if you want player/team images to persist. DB stays on TiDB.

---

## Prerequisites (once)
1. **Hugging Face account.** Revoke any leaked token, then create a new
   **Write** token (Settings → Access Tokens). Keep it private.
2. **GitHub secret:** repo → Settings → Secrets and variables → Actions → New
   repository secret → name **`HF_TOKEN`**, value = the write token.
3. **Username:** confirm `HF_USERNAME` in both workflows
   (`.github/workflows/deploy-hf.yml` and `deploy-hf-backend.yml`) is your HF
   username — it's set to `AK1B12B1`; change that one line if different.

---

## Part 1 — AI service → HF
1. **huggingface.co/new-space** → name **`localscore-ai`** → SDK **Docker** →
   **CPU basic (free)** → **Public** → Create.
2. Deploy: GitHub → **Actions → "Deploy AI to Hugging Face" → Run workflow**
   (or push any change under `ai-service/`).
3. Watch the Space **Logs** until **Running**. URL (App tab / ⋮ → Embed):
   `https://ak1b12b1-localscore-ai.hf.space` → check `/health`.

## Part 2 — Backend → HF
1. **huggingface.co/new-space** → name **`localscore-backend`** → SDK **Docker**
   → **CPU basic (free)** → **Public** → Create.
2. In that Space → **Settings → Variables and secrets** → add **Secrets**:
   | Secret | Value |
   |---|---|
   | `SECRET_KEY` | a long random string |
   | `DATABASE_URL` | `mysql+aiomysql://USER:PASS@HOST:4000/localscore` (TiDB) |
   | `SYNC_DATABASE_URL` | `mysql+pymysql://USER:PASS@HOST:4000/localscore` |
   | `DB_SSL` | `true` |
   | `AI_SERVICE_URL` | your HF AI URL from Part 1 |
   | `BACKEND_CORS_ORIGINS` | your web URL, e.g. `https://cricket-one-flax.vercel.app` |
   | `FRONTEND_URL` | same web URL |
   | `MAINTENANCE_TOKEN` | any random string |
   | *(optional)* `STORAGE_BACKEND=s3` + `S3_*` | for persistent image uploads (R2) |
   | *(optional)* `BREVO_API_KEY` / `SMTP_*` | for email |
3. Deploy: GitHub → **Actions → "Deploy Backend to Hugging Face" → Run workflow**.
4. Logs → **Running**. URL: `https://ak1b12b1-localscore-backend.hf.space` →
   check `/health` and `/docs`. (Boot runs `alembic upgrade head` automatically.)

## Part 3 — Point the web at the HF backend
Vercel → the **cricket** project → **Settings → Environment Variables** → set
(Production + Preview):
- `VITE_API_BASE_URL` = `https://ak1b12b1-localscore-backend.hf.space/api/v1`
- `VITE_SOCKET_URL` = `https://ak1b12b1-localscore-backend.hf.space`

Then **redeploy** the web (Deployments → ⋯ → Redeploy) so Vite picks up the new
values.

## Part 4 — Unblock Vercel deploys
Vercel Hobby blocks deploys from a non-owner author on a **private** repo. Fix
(free): GitHub → repo → **Settings → General → Change visibility → Public**
(verified: no secrets are committed). Then redeploy.

## Part 5 — SEO go-live (Google)
Once the web deploys (Part 4), `og-image.png`, `robots.txt`, `sitemap.xml`,
canonical + JSON-LD + the `google-site-verification` meta are live.
1. **search.google.com/search-console** → Add property → **URL prefix** → your URL.
2. **Verify** (the token meta is already in `index.html`) → click **Verify**.
3. **Sitemaps** → submit `sitemap.xml`.
4. **URL Inspection** → homepage → **Request indexing** (repeat for `/teams`,
   `/tournaments`, `/leaderboards`).
5. Confirm later with `site:cricket-one-flax.vercel.app` in Google.
6. Refresh social previews: **linkedin.com/post-inspector** + Facebook debugger.

---

## Order of operations
1. Revoke token → new write token → add `HF_TOKEN` GitHub secret.
2. Part 1 (AI) → get AI URL.
3. Part 2 (backend) → add Secrets (incl. AI URL) → get backend URL.
4. Part 3 (Vercel env → backend URL) + Part 4 (repo public) → redeploy web.
5. Part 5 (Search Console).

After this, everything runs **free**: web on Vercel, AI + backend on Hugging
Face, DB on TiDB. Render is no longer required (keep `render.yaml` as a fallback).
