---
title: LocalScore Backend
emoji: 🏏
colorFrom: green
colorTo: gray
sdk: docker
app_port: 8000
pinned: false
---

<!-- The YAML above lets this run as a free Hugging Face Docker Space (a fallback
     host when Render free is asleep/suspended). HF reads it from this README;
     Render ignores it. The container listens on 8000 (start.sh default). -->

# LocalScore — Backend (FastAPI + Socket.IO + AI)

REST API, realtime scoring, auth/RBAC, the scoring engine, **and the AI engine**
(`app/ai` — win-probability, commentary, summary, insights; runs in-process, no
separate service). Runs on **Render** (`render.yaml`) or a free **Hugging Face
Docker Space** (see [../docs/HUGGINGFACE_DEPLOY.md](../docs/HUGGINGFACE_DEPLOY.md)).

Run locally: see [../docs/CURRENT_STATE.md](../docs/CURRENT_STATE.md)
(`uvicorn app.main:socket_app --port 8000`).

## Required environment (set as Space **Secrets** when hosting on HF)
`SECRET_KEY`, `DATABASE_URL`, `SYNC_DATABASE_URL`, `DB_SSL=true`,
`BACKEND_CORS_ORIGINS` (your web URL), `FRONTEND_URL`, `MAINTENANCE_TOKEN`.
Optional: `GEMINI_API_KEY` (enables LLM commentary/insights; heuristics/templates
without it), email keys, and `STORAGE_BACKEND=s3` + `S3_*` (Cloudflare R2) for
persistent image uploads — HF disk is ephemeral. `AI_SERVICE_URL` is no longer
needed (AI is in-process).
