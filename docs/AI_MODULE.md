# AI Module Architecture — LocalScore

> **Update:** the AI now runs **in-process inside the backend** at
> `backend/app/ai/` (no separate service to host — one deploy, AI always
> available, no cold start). The old standalone `ai-service/` folder has been
> **removed** — its code now lives in `backend/app/ai/` (the **training pipeline**
> moved to `backend/app/ai/train/`).
> The notes below on the heuristic/LLM design still apply; only the hosting moved.

The AI is intentionally **dependency-light** (stdlib + httpx + pydantic — already
in the backend), so the heuristic predictors and template commentary add no heavy
ML libraries to the scoring API. The optional trained model (joblib) and LLM
(Gemini over HTTPS / OpenAI) activate only when configured; otherwise transparent
heuristics/templates are used, so a missing model or key can never break scoring.

```
 backend (app/ai, in-process)
   /public/matches/{id}/prediction  → win-probability (cached per score state)
   /api/v1/ai/win-probability        model | heuristic
   /api/v1/ai/best-player            performance index
   /api/v1/ai/commentary             LLM | template
   /api/v1/ai/summary                LLM | template
   /api/v1/ai/insights/player        form + strengths/weaknesses
                            │
                            ├─ app/features.py     state → features (stdlib only)
                            ├─ app/models/*        predictors (heuristic + joblib)
                            ├─ app/services/llm.py LangChain+OpenAI (optional)
                            └─ train/*             XGBoost/LightGBM pipeline
```

## Two-tier predictor pattern

Every model ships a **heuristic** that works on day one and a **slot for a
trained model** that overrides it once data exists — same API, no client change.

```
predict(state):
    if models/<name>.joblib exists:  use trained model (XGBoost/LightGBM)
    else:                            use transparent cricket heuristic
```

### Win probability & projected score
- Features: chase flag, runs, wickets, balls bowled/left, wickets in hand, CRR,
  RRR, runs needed (`app/features.py`).
- Heuristic: logistic blend of run-rate cushion (CRR−RRR), wickets in hand, and
  the difficulty of the remaining ask; first-innings projects a final score from
  current rate dampened by wickets lost.
- Trained path: `train/train_win_probability.py` builds a labelled dataset
  (in-progress state → eventual result), trains XGBoost (→ LightGBM → sklearn
  fallback), and persists `models/win_probability.joblib`. Until real historical
  data is wired in, it synthesises a dataset so the full train→serve loop is
  runnable.

### Best-player performance index
Transparent weighted score over batting (runs + SR bonus), bowling (wickets +
economy bonus), and fielding (catches). Documented weights; swappable for a
learned "player of the match" classifier later.

### Smart commentary & match summary
`app/services/llm.py` wraps LangChain + OpenAI and is **fully optional**: with no
`OPENAI_API_KEY`, commentary and summaries fall back to deterministic templates,
so the feature degrades to readable text rather than failing.

### Player insights
Form classification (hot/steady/cold) + strengths/weaknesses from recent scores,
strike rates, and wickets, with a recency-weighted form index.

## Roadmap to production models
1. Add a backend job exporting completed matches' ball-by-ball states + outcomes.
2. Point `train/` at that export instead of the synthetic generator.
3. Schedule retraining (e.g. nightly) writing new `*.joblib` artifacts to shared
   storage; the service hot-loads them on next request.
4. Add model versioning + offline eval (AUC/Brier) gates before promotion.
