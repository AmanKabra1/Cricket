# LocalScore — What's Next

## Done ✅ (phases 1–12)
Core platform · AI win-probability · mobile app · player career stats +
leaderboards · tournament leaderboards / MVP / Player-of-the-Match · reliability
(CI, `/health` + `/ready`, Sentry on web + backend) · engagement (push
notifications + follow team/tournament + knockout bracket) · branded HTML emails.

Live on **Vercel** (web) + **Render** (backend + AI) + **TiDB Cloud**; app via
**EAS**. (See `DEPLOYMENT_AND_SCALING.md` and `CURRENT_STATE.md`.)

---

## Candidate next work (pick any)

1. **Shareable match cards** — generate an image / OG card per match for social
   sharing (growth lever).
2. **AI LLM commentary & summaries** — wire **Gemini** (free, ~1,500 req/day) in
   `ai-service`; auto ball-by-ball commentary + innings/match summaries, cached.
   Needs `GEMINI_API_KEY` + `AI_COMMENTARY_ENABLED`; keep the template fallback.
3. **Trained win-probability model** — XGBoost/LightGBM on our own `balls` data
   to replace the heuristic (`training_data.py` already scaffolds the export);
   nightly retrain via GitHub Actions. No API change (the loader swaps it in).
4. **Scale hardening** — load-test to the ~10k-concurrent target (k6 / Locust),
   then wire **Redis cache + Socket.IO Redis adapter** for multi-instance
   (see `DEPLOYMENT_AND_SCALING.md` §4) and move media to S3 / Cloudflare R2.
5. **Offline-friendly scoring** — queue balls locally on poor networks and sync.
6. **Multi-sport** — a second `ScoringEngine` (football / kabaddi) behind the
   existing interface (teams/tournaments/venues are already sport-agnostic).

## On hold / optional
- **Play Store submission** — intentionally on hold.
- **App crash reporting** — re-add `@sentry/react-native` only with a setup
  verified for Expo SDK 54 / RN 0.81 (it broke EAS builds before).
- **Activate Sentry** — create free sentry.io projects and set `SENTRY_DSN`
  (Render) + `VITE_SENTRY_DSN` (Vercel).

## Recommended
**#2 (Gemini LLM commentary)** is the biggest visible upgrade for the least work
— the AI service and graceful-fallback proxy already exist, so it's mostly adding
a provider + a free key. **#1 (shareable cards)** is the best growth lever if the
goal is reach. Pick based on whether you want "wow" or "spread".
