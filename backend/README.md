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

# LocalScore — Backend (FastAPI + Socket.IO)

REST API, realtime scoring, auth/RBAC and the scoring engine. Primary host is
**Render** (`render.yaml`); it can also run on a free **Hugging Face Docker
Space** as a fallback (see [../docs/DEPLOYMENT_AND_SCALING.md](../docs/DEPLOYMENT_AND_SCALING.md)).

Run locally: see [../docs/CURRENT_STATE.md](../docs/CURRENT_STATE.md)
(`uvicorn app.main:socket_app --port 8000`).

## Required environment (set as Space **Secrets** when hosting on HF)
`SECRET_KEY`, `DATABASE_URL`, `SYNC_DATABASE_URL`, `DB_SSL=true`,
`BACKEND_CORS_ORIGINS` (your web URL), `FRONTEND_URL`, `AI_SERVICE_URL`,
`MAINTENANCE_TOKEN`, and email/storage keys as needed. Without storage keys,
image uploads won't persist on HF (ephemeral disk) — set `STORAGE_BACKEND=s3` +
`S3_*` (Cloudflare R2) for persistent media.
