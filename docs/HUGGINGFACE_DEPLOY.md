# LocalScore — Deploy on Hugging Face (free, ONE Space) + SEO go-live

The AI is now **built into the backend** (`backend/app/ai`), so you deploy **one
Space** — the backend — and it serves the API, realtime, **and** AI. No separate
AI service, no `AI_SERVICE_URL`, no HF hardware-quota clash.

## Where the changes are
- **App code:** none needed to deploy. The backend Dockerfile, port (`app_port:
  8000` → HF sets `$PORT` to match), and CORS (`… or ["*"]`) already work on HF.
  The AI runs in-process. README front-matter + the backend workflow are committed.
- **Config you set (no coding):** 1 HF Space + its Secrets, 1 GitHub secret,
  Vercel env vars, GitHub repo visibility, Google Search Console.

> HF free has **no monthly hour cap**; a Space sleeps only after **48h** idle.
> Uploads are **ephemeral** on HF — set `STORAGE_BACKEND=s3` + `S3_*` (Cloudflare
> R2) if you want player/team images to persist. DB stays on TiDB.

---

## Prerequisites (once)
1. **Hugging Face account.** Revoke any leaked token; create a new **Write** token.
2. **GitHub secret:** repo → Settings → Secrets and variables → Actions → New
   repository secret → name **`HF_TOKEN`**, value = the write token.
3. Confirm `HF_USERNAME` in `.github/workflows/deploy-hf-backend.yml` (it's
   `AK1B12B1`).

## Part 1 — Deploy the backend (which includes AI)
1. **huggingface.co/new-space** → name **`localscore-backend`** → SDK **Docker**
   → **CPU basic (free)** → **Public** → Create.
2. Space → **Settings → Variables and secrets** → add **Secrets** (copy values
   from Render's Export):
   | Secret | Value |
   |---|---|
   | `SECRET_KEY` | a long random string |
   | `DATABASE_URL` | `mysql+aiomysql://USER:PASS@HOST:4000/localscore` (TiDB) |
   | `SYNC_DATABASE_URL` | `mysql+pymysql://USER:PASS@HOST:4000/localscore` |
   | `DB_SSL` | `true` |
   | `BACKEND_CORS_ORIGINS` | your web URL, e.g. `https://cricket-one-flax.vercel.app` |
   | `FRONTEND_URL` | same web URL |
   | `MAINTENANCE_TOKEN` | any random string |
   | *(optional)* `GEMINI_API_KEY` | enables LLM commentary/insights (free at aistudio.google.com/apikey) |
   | *(optional)* `STORAGE_BACKEND=s3` + `S3_*` | persistent image uploads (R2) |
   - You **don't** need `AI_SERVICE_URL` anymore.
3. Deploy: GitHub → **Actions → "Deploy Backend to Hugging Face" → Run workflow**.
4. Space → **Logs** → wait for `Application startup complete` (boot runs
   `alembic upgrade head`). Test:
   - `https://ak1b12b1-localscore-backend.hf.space/health` → `{"status":"ok"}`
   - `…/api/v1/ai/health` → `{"status":"ok","llm":false|true}`
   - `…/docs`

## Part 2 — Point the web at it
Vercel → **cricket → Settings → Environment Variables** (Production + Preview):
- `VITE_API_BASE_URL` = `https://ak1b12b1-localscore-backend.hf.space/api/v1`
- `VITE_SOCKET_URL` = `https://ak1b12b1-localscore-backend.hf.space`
→ **Redeploy** the web.

## Part 3 — Unblock Vercel deploys
Vercel Hobby blocks deploys from a non-owner author on a **private** repo. Fix
(free): GitHub → repo → **Settings → General → Change visibility → Public**
(no secrets are committed). Or redeploy from the Vercel dashboard (deploys as the
owner) for a one-off.

## Part 4 — SEO go-live (Google)
Once the web is deployed, `og-image.png`, `robots.txt`, `sitemap.xml`, canonical,
JSON-LD and the `google-site-verification` meta are live.
1. **search.google.com/search-console** → Add property → **URL prefix** → your URL.
2. **Verify** (token already in `index.html`) → Verify.
3. **Sitemaps** → submit `sitemap.xml`.
4. **URL Inspection** → request indexing of `/`, `/teams`, `/tournaments`, `/leaderboards`.
5. Refresh previews: **linkedin.com/post-inspector** + Facebook debugger.

---

## Free architecture (final)
| Service | Free host |
|---|---|
| Web | Vercel |
| **Backend + AI (one Space)** | Hugging Face |
| DB | TiDB Cloud |

Render is no longer required (keep `render.yaml` as an optional fallback). The AI
is in the backend (`backend/app/ai`); the old standalone `ai-service/` folder has
been removed (the training pipeline lives in `backend/app/ai/train/`).

## Order of operations
1. Revoke token → new write token → add `HF_TOKEN` GitHub secret.
2. Part 1 (backend Space + Secrets) → run the workflow → get the URL.
3. Part 2 (Vercel env → that URL) + Part 3 (repo public) → redeploy web.
4. Part 4 (Search Console).
