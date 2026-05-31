# Deploy V1 on free tiers — step by step

Goal: get LocalScore live on the internet using **only free plans**. Upgrade
individual pieces to paid later (see the table in [DEPLOYMENT.md](DEPLOYMENT.md)).

**Free stack:** Web → Vercel Hobby · Backend + AI → Render Free · DB → TiDB
Cloud Serverless · Redis → optional (skip for V1) · Images → optional (skip) ·
AI text → templates (no OpenAI key).

> ⚠️ Render Free web services **sleep after ~15 min idle** → the first request
> after a quiet period takes ~30–60s to wake. Fine for a V1/demo.

You'll need free accounts: **GitHub, TiDB Cloud, Render, Vercel.** I (Claude) can
drive the config with you — ping me when you're at each step, especially the DB.

---

## Step 0 — Push the code to GitHub
The repo is committed locally but has no remote yet.
```bash
cd Cricket
# create an EMPTY repo at github.com/new (no README), then:
git remote add origin https://github.com/<your-username>/localscore.git
git push -u origin main
```
After this the code + the GitHub Actions CI appear in your account.

## Step 1 — Database: TiDB Cloud Serverless (free)
1. Sign up at tidbcloud.com → create a **Serverless** cluster (free).
2. Create a database named `localscore` (SQL editor: `CREATE DATABASE localscore;`).
3. Click **Connect** → copy host, port (`4000`), user (looks like `xxxxx.root`), password.
4. You'll use these in Step 2 as:
   - `DATABASE_URL` = `mysql+aiomysql://USER:PASSWORD@HOST:4000/localscore`
   - `SYNC_DATABASE_URL` = `mysql+pymysql://USER:PASSWORD@HOST:4000/localscore`
   - `DB_SSL` = `true`  ← TiDB requires TLS; the app handles it via the system CA.
   (No `?ssl=...` params needed — `DB_SSL=true` is enough.)

## Step 2 — Backend + AI: Render (free)
1. render.com → **New → Blueprint** → connect your GitHub repo. Render reads
   [`render.yaml`](../render.yaml) and proposes: `localscore-backend`,
   `localscore-ai`, `localscore-redis` (all on `free`).
   - *Optional:* delete the `localscore-redis` service in the blueprint UI — the
     backend runs fine without it on a single free instance (in-memory cache).
2. Set the backend's secret env vars (the `sync:false` ones) in the dashboard:
   - `DATABASE_URL`, `SYNC_DATABASE_URL` (from Step 1), `DB_SSL=true`
   - `BACKEND_CORS_ORIGINS` = leave blank for now (fill after Step 3)
   - `AI_SERVICE_URL` = the AI service's internal URL (Render shows it once
     `localscore-ai` deploys; format `http://localscore-ai:10000`)
   - `S3_*` = leave blank (image uploads are off in V1; everything else works)
3. Deploy. The backend command runs `alembic upgrade head` automatically, so the
   TiDB tables are created on first boot. Watch logs until `/health` is green:
   `https://localscore-backend-XXXX.onrender.com/health`

## Step 3 — Web: Vercel (free)
1. vercel.com → **Add New → Project** → import the repo.
2. **Root Directory: `web`**. Framework auto-detects Vite (config in
   [`web/vercel.json`](../web/vercel.json)).
3. Add env vars:
   - `VITE_API_BASE_URL` = `https://localscore-backend-XXXX.onrender.com/api/v1`
   - `VITE_SOCKET_URL`  = `https://localscore-backend-XXXX.onrender.com`
4. Deploy → you get `https://localscore-XXXX.vercel.app`.

## Step 4 — Connect CORS + create your admin
1. Back in Render, set the backend `BACKEND_CORS_ORIGINS` to your Vercel URL and
   redeploy.
2. **Create a super admin** (no shell needed on free tier):
   - Register a user from the live site (or `POST /api/v1/auth/register`).
   - In the TiDB SQL editor, promote it:
     ```sql
     UPDATE localscore.users SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
     ```
3. Log in on the site → **Manage** tab → create teams, players, a match → score it.
   Spectators can watch live with no login.

## Done 🎉
- Web: `https://localscore-XXXX.vercel.app`
- API docs: `https://localscore-backend-XXXX.onrender.com/docs`
- Pushes to `main` auto-deploy (Render + Vercel) and run CI.

## Turning on the optional bits later (V2 / when needed)
| Feature | Free now? | To enable |
|---|---|---|
| Always-on (no cold start) | — | Render plan → `starter` ($7/mo each) |
| Image uploads (logos/photos) | off | Cloudflare R2 (free 10GB) or AWS S3, set `S3_*` |
| Redis (multi-instance scaling) | optional | keep `localscore-redis` or use Upstash free |
| AI commentary/summaries (LLM) | templates | set `OPENAI_API_KEY` on `localscore-ai` |
| Mobile app store release | Expo Go free | EAS Build + Apple/Google accounts |
